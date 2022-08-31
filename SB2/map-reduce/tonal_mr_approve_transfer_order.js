/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/format'], function (
  search,
  record,
  format,
) {
  function getInputData() {
    try {
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
          name: 'mainline',
          operator: search.Operator.IS,
          values: true,
        }),
        search.createFilter({
          name: 'custbody_to_classification',
          operator: search.Operator.ANYOF,
          values: 2,
        }),
      ]

      const columns = [
        search.createColumn({ name: 'internalid' }),
        search.createColumn({ name: 'location' }),
        search.createColumn({ name: 'datecreated' }),
      ]

      const orders = []
      search
        .create({
          type: search.Type.TRANSACTION,
          filters: filters,
          columns: columns,
        })
        .run()
        .each((results) => {
          const order = {
            id: results.id,
            originlocation: results.getValue({ name: 'location' }),
            datecreated: results.getValue({ name: 'datecreated' }),
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
      data.executiondate = getExecutionDate(new Date())
      data.numberoflines = getLineCount(data.id)

      if (data.originlocation) {
        const output = getLocationDetails(data.originlocation)

        for (let key in output) {
          if (output[key] !== false) data[key] = output[key]

          if (key === 'orderlimit') data.orderlimit = output[key]

          if (key === 'overagelimit') data.overagelimit = output[key]
        }
      }

      context.write({
        key: data.originlocation,
        value: data,
      })
    } catch (error) {
      log.debug('ERROR - MAP', error.message)
      log.debug('ERROR - MAP - ST', error.stack)
    }
  }

  function reduce(context) {
    log.debug(context.key, context.values)
    const orders = []

    context.values.forEach((order) => {
      orders.push(JSON.parse(order))
    })

    const order_data = []
    orders.forEach((order) => {
      if (
        order.hasOwnProperty(order.executiondate) === true &&
        order[order.executiondate] === true
      ) {
        let data = {}
        data.id = order.id
        data.date = format.parse({
          value: order.datecreated,
          type: format.Type.DATETIMETZ,
          timezone: format.Timezone.AMERICA_LOS_ANGELES,
        })
        data.orderlimit = parseInt(order.orderlimit) || 0
        data.overagelimit = parseInt(order.overagelimit) || 0

        data = getReleasePriority(order.id, data)
        order_data.push(data)
      }
    })
    if (order_data.length > 0) {
      let sortedData = order_data.sort(
        sortData('HIGH', 'MEDIUM', 'LOW', 'id'),
      )
      log.debug('data', sortedData)
      processData(context.key, sortedData)
    }
  }

  function summarize(summary) {}

  const getLocationDetails = (originlocation) => {
    const location = {}
    const locationRecord = record.load({
      type: record.Type.LOCATION,
      id: originlocation,
    })

    location.orderlimit = locationRecord.getValue({
      fieldId: 'custrecord_order_limit',
    })
    location.overagelimit = locationRecord.getValue({
      fieldId: 'custrecord_overrage_limit',
    })
    location.monday = locationRecord.getValue({
      fieldId: 'custrecord_monday',
    })
    location.tuesday = locationRecord.getValue({
      fieldId: 'custrecord_tuesday',
    })
    location.wednesday = locationRecord.getValue({
      fieldId: 'custrecord_wednesday',
    })
    location.thursday = locationRecord.getValue({
      fieldId: 'custrecord_thursday',
    })
    location.friday = locationRecord.getValue({
      fieldId: 'custrecord_friday',
    })
    location.saturday = locationRecord.getValue({
      fieldId: 'custrecord_saturday',
    })
    location.sunday = locationRecord.getValue({
      fieldId: 'custrecord_sunday',
    })

    return location
  }

  const getExecutionDate = (date) => {
    const d = new Date()
    let weekday = new Array(7)
    weekday[0] = 'sunday'
    weekday[1] = 'monday'
    weekday[2] = 'tuesday'
    weekday[3] = 'wednesday'
    weekday[4] = 'thursday'
    weekday[5] = 'friday'
    weekday[6] = 'saturday'

    let day = weekday[d.getDay()]

    return day
  }

  const getLineCount = (toID) => {
    const transferOrder = record.load({
      type: record.Type.TRANSFER_ORDER,
      id: toID,
    })

    return transferOrder.getLineCount({ sublistId: 'item' })
  }

  const getReleasePriority = (transferorder, data) => {
    try {
      let HIGH_PRIORITY = 0
      let MEDIUM_PRIORITY = 0
      let LOW_PRIORITY = 0
      let NO_PRIORITY = 0

      const arrayOfSalesOrder = []

      const xferOrder = record.load({
        type: 'transferorder',
        id: transferorder,
      })
      const numberoflines = xferOrder.getLineCount({
        sublistId: 'item',
      })

      for (var i = 0; i < numberoflines; i++) {
        const so = xferOrder.getSublistValue({
          sublistId: 'item',
          fieldId: 'custcol_sales_order',
          line: i,
        })

        const priority = xferOrder.getSublistValue({
          sublistId: 'item',
          fieldId: 'orderpriority',
          line: i,
        })
        if (priority === 1) HIGH_PRIORITY++
        if (priority === 2) MEDIUM_PRIORITY++
        if (priority === 3) LOW_PRIORITY++
        if (priority === '') NO_PRIORITY++
        if (arrayOfSalesOrder.indexOf(so) === -1) {
          arrayOfSalesOrder.push(so)
          // orderCount++
        }
      }
      data.HIGH = HIGH_PRIORITY
      data.MEDIUM = MEDIUM_PRIORITY
      data.LOW = LOW_PRIORITY
      data.NO = NO_PRIORITY
      data.NUMBER_OF_SALES_ORDERS = arrayOfSalesOrder.length
      data.id = transferorder

      return data
    } catch (error) {
      log.debug('error', error)
    }
  }

  const sortData = (...properties) => {
    return function (objectA, objectB) {
      const a = objectA[properties[0]]
      const b = objectB[properties[0]]

      if (a < b) return 1
      if (a > b) return -1
      if (properties.length > 1)
        return sortData(...properties.slice(1))(objectA, objectB)
      return 0
    }
  }

  const processData = (locationid, sortedData) => {
    let tempLocation = locationid
    if (tempLocation === locationid) {
      let orderlimit = sortedData[0].orderlimit
      let overagelimit = sortedData[0].overagelimit
      let total = orderlimit + overagelimit
      let sum = 0
      for (let i = 0; i < sortedData.length; i++) {
        if (sum < orderlimit) {
          const transferOrder = record.load({
            type: record.Type.TRANSFER_ORDER,
            id: sortedData[i].id,
          })
          transferOrder.setValue({
            fieldId: 'orderstatus',
            value: 'B',
          })
          transferOrder.save()
          orderlimit -= sortedData[i].NUMBER_OF_SALES_ORDERS
          continue
        }

        if (sum === orderlimit) {
          orderlimit = Math.abs(orderlimit - sum)
        }

        if (sum > orderlimit) {
          let difference = Math.abs(orderlimit - sum)
          if (difference < overagelimit) {
            overagelimit = Math.abs(overagelimit - difference)
            orderlimit = 0
          }
        }

        if (sum < total) {
          const transferOrder = record.load({
            type: record.Type.TRANSFER_ORDER,
            id: sortedData[i].id,
          })
          transferOrder.setValue({
            fieldId: 'orderstatus',
            value: 'B',
          })
          transferOrder.save()
          orderlimit -= sortedData[i].NUMBER_OF_SALES_ORDERS
        }
      }

      log.debug('Order Limit Remaining', orderlimit)
      log.debug('Overage Limit Remaining', overagelimit)
    }
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
