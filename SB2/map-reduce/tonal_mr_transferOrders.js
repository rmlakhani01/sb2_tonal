/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record'], function (search, record) {
  function getInputData() {
    try {
      const filters = [
        search.createFilter({
          name: 'type',
          operator: search.Operator.ANYOF,
          values: 'SalesOrd',
        }),
        search.createFilter({
          name: 'mainline',
          operator: search.Operator.IS,
          values: 'F',
        }),
        search.createFilter({
          name: 'taxline',
          operator: search.Operator.IS,
          values: 'F',
        }),
        search.createFilter({
          name: 'type',
          join: 'item',
          operator: search.Operator.ANYOF,
          values: 'InvtPart',
        }),
        search.createFilter({
          name: 'status',
          operator: search.Operator.ANYOF,
          values: 'SalesOrd:B',
        }),
        search.createFilter({
          name: 'custcol_transfer_order',
          operator: search.Operator.ANYOF,
          values: '@NONE@',
        }),
        search.createFilter({
          name: 'location',
          operator: search.Operator.NONEOF,
          values: '@NONE@',
        }),
      ]

      const columns = [
        search.createColumn({
          name: 'internalid',
          summary: search.Summary.GROUP,
        }),
        search.createColumn({
          name: 'location',
          summary: search.Summary.GROUP,
        }),
        search.createColumn({
          name: 'item',
          summary: search.Summary.GROUP,
        }),
        search.createColumn({
          name: 'quantity',
          summary: search.Summary.GROUP,
        }),
        search.createColumn({
          name: 'orderpriority',
          summary: search.Summary.GROUP,
        }),
        search.createColumn({
          name: 'trandate',
          summary: search.Summary.GROUP,
        }),
      ]

      const orders = []
      search
        .create({
          type: 'transaction',
          filters: filters,
          columns: columns,
        })
        .run()
        .each((result) => {
          const order = {
            so: result.getValue({
              name: 'internalid',
              summary: search.Summary.GROUP,
            }),
            location: result.getValue({
              name: 'location',
              summary: search.Summary.GROUP,
            }),
            item: result.getValue({
              name: 'item',
              summary: search.Summary.GROUP,
            }),
            quantity: result.getValue({
              name: 'quantity',
              summary: search.Summary.GROUP,
            }),
            priority: result.getValue({
              name: 'orderpriority',
              summary: search.Summary.GROUP,
            }),
            date: result.getValue({
              name: 'trandate',
              summary: search.Summary.GROUP,
            }),
          }
          orders.push(order)
          return true
        })

      return orders
    } catch (error) {
      log.debug('ERROR - getInputData', error.message)
      log.debug('ERROR - getInputData - ST', error.stack)
    }
  }

  function map(context) {
    try {
      const data = JSON.parse(context.value)
      // cross reference table is a 1 to 1 mapping for the destination location to the origin location. will only return 1 result.
      if (data.location) {
        const originLocation = getLocation(data.location)
        data.fromlocation = originLocation[0]
      }

      context.write({
        key: data.location,
        value: data,
      })
    } catch (error) {
      log.debug('ERROR - map', error.message)
      log.debug('ERROR - map - ST', error.stack)
    }
  }

  function reduce(context) {
    try {
      const salesOrders = context.values
      const openTransferOrders = getTransferOrders(context.key)

      log.debug('openTransferOrders', openTransferOrders)
      const orders = salesOrders.map((order) => JSON.parse(order))
      const details = computeRemaining(orders, openTransferOrders)
      const results = groupResults(details.so, orders)
      log.debug('results', [...results.entries()])

      const newTOs = processOrders(
        openTransferOrders,
        details,
        results,
      )

      if (openTransferOrders.length != 0) {
        updateSalesOrders(openTransferOrders)
      }

      if (newTOs && newTOs.length != 0) {
        updateSalesOrders(newTOs)
      }
    } catch (error) {
      log.debug('ERROR - reduce', error.message)
      log.debug('ERROR - reduce - ST', error.stack)
    }
  }

  function summarize(summary) {
    summary.output.iterator().each((key, value) => {
      log.debug(key, value)
      return true
    })
  }

  const getTransferOrders = (location) => {
    const filters = [
      search.createFilter({
        name: 'type',
        operator: search.Operator.ANYOF,
        values: 'TrnfrOrd',
      }),
      search.createFilter({
        name: 'status',
        operator: search.Operator.ANYOF,
        values: 'TrnfrOrd:A',
      }),
      search.createFilter({
        name: 'location',
        operator: search.Operator.ANYOF,
        values: location,
      }),
      search.createFilter({
        name: 'custbody_ready_for_release',
        operator: search.Operator.IS,
        values: 'F',
      }),
    ]

    const columns = [search.createColumn({ name: 'internalid' })]

    const xferOrders = []

    const results = search
      .create({
        type: 'transaction',
        filters: filters,
        columns: columns,
      })
      .run()
      .each((result) => {
        if (
          xferOrders.indexOf(
            result.getValue({ name: 'internalid' }),
          ) === -1
        ) {
          xferOrders.push(result.getValue({ name: 'internalid' }))
        }
        return true
      })

    if (typeof results === undefined) xferOrders = []

    return xferOrders
  }

  const getLocation = (location) => {
    const originLocation = []
    const filters = [
      search.createFilter({
        name: 'custrecord_destination',
        operator: search.Operator.ANYOF,
        values: location,
      }),
    ]

    const columns = [
      search.createColumn({ name: 'custrecord_origin' }),
    ]

    search
      .create({
        type: 'customrecord_last_mile_crt',
        filters: filters,
        columns: columns,
      })
      .run()
      .each((result) => {
        originLocation.push(
          result.getValue({ name: 'custrecord_origin' }),
        )

        return true
      })

    return originLocation
  }

  const updateSalesOrders = (to) => {
    to.forEach((order) => {
      const salesorders = new Set()
      const transferOrder = record.load({
        type: record.Type.TRANSFER_ORDER,
        id: order,
        isDynamic: true,
      })

      const lineCount = transferOrder.getLineCount({
        sublistId: 'item',
      })
      for (var i = 0; i < lineCount; i++) {
        salesorders.add(
          transferOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_sales_order',
            line: i,
          }),
        )
      }

      for (const soid of salesorders.keys()) {
        const so = record.load({
          type: record.Type.SALES_ORDER,
          id: soid,
        })

        const count = so.getLineCount({ sublistId: 'item' })
        for (var i = 0; i < count; i++) {
          so.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_transfer_order',
            value: order,
            line: i,
          })
        }
        so.save()
      }
    })
  }

  const createTransferOrder = (lines, details) => {
    let to = []

    // required to extract the location and transfer location from the map object.
    let data = []
    for (const key of lines.keys()) {
      const d = lines.get(key)
      data.push(d[0])
    }

    for (var i = 0; i < details.recordcount; i++) {
      let soCount = new Set()
      let transferOrder = record.create({
        type: record.Type.TRANSFER_ORDER,
        isDynamic: true,
      })

      transferOrder.setValue({
        fieldId: 'location',
        value: data[0].fromlocation,
      })
      transferOrder.setValue({
        fieldId: 'transferlocation',
        value: data[0].location,
      })

      transferOrder.setValue({
        fieldId: 'custbody_to_classification',
        value: 2,
      })

      for (const [key, order] of lines.entries()) {
        if (soCount.size === details.max) break
        order.forEach((line) => {
          soCount.add(line.so)
          transferOrder.selectNewLine({ sublistId: 'item' })
          transferOrder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: line.item,
          })
          transferOrder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: line.quantity,
          })
          if (line.priority) {
            transferOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'orderpriority',
              value: line.priority,
            })
          }
          transferOrder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_sales_order',
            value: line.so,
          })
          transferOrder.commitLine({ sublistId: 'item' })
        })
        lines.delete(key)
      }
      if (soCount.size === details.max) {
        transferOrder.setValue({
          fieldId: 'custbody_ready_for_release',
          value: true,
        })
      }
      to.push(transferOrder.save())
    }
    return to
  }

  const updateTransferOrder = (to, lines) => {
    try {
      const max = 30
      for (var i = 0; i < to.length; i++) {
        let soCount = new Set()
        let transferOrder = record.load({
          type: record.Type.TRANSFER_ORDER,
          id: to[i],
          isDynamic: true,
        })
        // log.debug('set size', soCount.size)
        // log.debug('transfer order', to[i])

        const lineCount = transferOrder.getLineCount({
          sublistId: 'item',
        })

        // loop through existing lines and extract existing unique SOIDS
        for (var y = 0; y < lineCount; y++) {
          soCount.add(
            transferOrder.getSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_sales_order',
              line: y,
            }),
          )
        }

        // log.debug(
        //   'set size after existing lines have been processed',
        //   soCount.size,
        // )

        for (const [key, order] of lines.entries()) {
          if (soCount.size === max) break
          order.forEach((line) => {
            soCount.add(order.so)
            transferOrder.selectNewLine({ sublistId: 'item' })
            transferOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              value: line.item,
            })
            transferOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              value: line.quantity,
            })
            if (line.priority) {
              transferOrder.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'orderpriority',
                value: line.priority,
              })
            }
            transferOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'custcol_sales_order',
              value: line.so,
            })
            transferOrder.commitLine({ sublistId: 'item' })
          })
          lines.delete(key)
        }
        if (soCount.size === max) {
          transferOrder.setValue({
            fieldId: 'custbody_ready_for_release',
            value: true,
          })
        }
        transferOrder.save()
      }
    } catch (error) {
      log.debug('error', JSON.stringify(error))
    }
  }

  const computeRemaining = (lines, to) => {
    const transferOrderDetails = {}
    const so = new Set()
    const MAX_LINES = 30

    // get unique sales orders
    for (let i = 0; i < lines.length; i++) {
      so.add(lines[i].so)
    }

    let amount = so.size / MAX_LINES
    transferOrderDetails.numberOfSalesOrdersAllowed =
      Math.ceil(amount) * MAX_LINES - so.size
    transferOrderDetails.recordcount = Math.ceil(so.size / MAX_LINES)
    transferOrderDetails.socount = so.size
    transferOrderDetails.max = MAX_LINES
    transferOrderDetails.transferOrderCount = to.length
    transferOrderDetails.so = so

    return transferOrderDetails
  }

  const groupResults = (salesOrderSet, orders) => {
    const transferOrderLines = new Map()
    for (const key of salesOrderSet) {
      transferOrderLines.set(
        key,
        orders.filter((order) => order.so === key),
      )
    }

    return transferOrderLines
  }

  const processOrders = (to, details, results) => {
    let transferOrders

    if (to.length > 0) updateTransferOrder(to, results)

    if (to.length === 0) {
      transferOrders = createTransferOrder(results, details)
      log.debug('New Transfer Order Ids', transferOrders)
    }
    
    
    return transferOrders
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
