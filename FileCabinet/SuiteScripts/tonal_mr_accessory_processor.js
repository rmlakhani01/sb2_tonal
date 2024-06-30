/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/record', 'N/search'], function (record, search) {
  const getInputData = () => {
    const results = []
    search
      .create({
        type: 'customrecord_accessory_staging',
        filters: [
          {
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false,
          },
          {
            name: 'custrecord_stg_status',
            operator: search.Operator.IS,
            values: ['1'],
          },
        ],
        columns: [
          { name: 'internalid' },
          { name: 'custrecord_stg_tracking_num' },
          { name: 'custrecord_stg_header' },
          { name: 'custrecord_stg_lines' },
          { name: 'custrecord_stg_class' },
        ],
      })
      .run()
      .each((result) => {
        results.push({
          id: result.getValue({ name: 'internalid' }),
          trackingNum: result.getValue({
            name: 'custrecord_stg_tracking_num',
          }),
          header: result.getValue({
            name: 'custrecord_stg_header',
          }),
          lines: result.getValue({
            name: 'custrecord_stg_lines',
          }),
          class: result.getValue({
            name: 'custrecord_stg_class',
          }),
        })
        return true
      })

    log.debug('Number of Results', results.length)
    return results
  }

  const map = (context) => {
    const data = JSON.parse(context.value)
    context.write({ key: data.trackingNum, value: data })
  }

  const reduce = (context) => {
    try {
      let order = {}
      let result
      let headerData, lineData
      const key = context.key
      const data = JSON.parse(context.values)

      if (typeof data.header === 'string')
        headerData = JSON.parse(data.header)
      if (typeof data.lines === 'string')
        lineData = JSON.parse(data.lines)

      let salesOrderKey = headerData.Distribution_Center.startsWith(
        'G',
      )
        ? 'ORDER_NUMBER'
        : 'Delivery_ID'

      order.salesOrderId = getSalesOrder(headerData[salesOrderKey])
      order.salesOrderId
        ? (order.orderExists = true)
        : (order.orderExists = false)
      order.shipDate = headerData.SHIP_DATE || headerData.Ship_Date
      order.shipConfirmLines = orderData(lineData)

      if (order.orderExists === true && order.salesOrderId) {
        order.salesOrderLines = getSalesOrderLines(order.salesOrderId)
        order.shipConfirmLines.length > 0
          ? (order.skuExists = true)
          : (order.skuExists = false)
        order.salesOrderLines = removeDefaultItems(
          order.salesOrderLines,
        )
        order.matchingItems = getMatchingItems(
          order.shipConfirmLines,
          order.salesOrderLines,
        )
        order.uniqueItems = getUniqueItems(
          order.matchingItems,
          order.shipConfirmLines,
          order.salesOrderLines,
        )

        if (order.matchingItems.length > 0) {
          order.inventoryItems = order.matchingItems.filter(
            (item) =>
              item.itemType === 'InvtPart' ||
              item.itemType === 'Kit' ||
              item.itemType === 'Assembly',
          )
          order.isItemsMatching = true
          order.isInventoryItems =
            order.inventoryItems.length > 0 ? true : false
        }

        if (order.matchingItems.length === 0) {
          order.inventoryItems = order.uniqueItems.filter(
            (item) =>
              item.itemType === 'InvtPart' ||
              item.itemType === 'Kit' ||
              item.itemType === 'Assembly',
          )
          order.isItemsMatching = false
          order.isInventoryItems =
            order.inventoryItems.length > 0 ? true : false
        }
      }

      if (order.orderExists === false) {
        order.shipConfirmLines.length > 0
          ? (order.skuExists = true)
          : (order.skuExists = false)

        order.inventoryItems = order.shipConfirmLines.filter(
          (item) =>
            item.itemType === 'InvtPart' ||
            item.itemType === 'Kit' ||
            item.itemType === 'Assembly',
        )
        order.isInventoryItems =
          order.inventoryItems.length > 0 ? true : false
        order.IsOrderIdContainUA =
          headerData[salesOrderKey].includes('UA') === true
            ? true
            : false
      }

      order.location = getLocation(headerData.Distribution_Center)
      order.stageId = data.id
      order.orderId = headerData[salesOrderKey]
      order.trackingNum =
        lineData[0].TRACKING_NUMBER || lineData[0].Tracking
      log.debug('order', order)

      // LEFT SIDE
      if (order.orderExists === true) {
        if (order.IsOrderIdContainUA === true) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
            soId: order.salesOrderId,
          }
        }

        if (order.skuExists === false) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
            soId: order.salesOrderId,
          }
        }

        if (
          order.skuExists === true &&
          order.isItemsMatching === true &&
          order.isInventoryItems === false
        ) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
            soId: order.salesOrderId,
          }
        }

        if (
          order.skuExists === true &&
          order.isItemsMatching === false &&
          order.isInventoryItems === false
        ) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
            soId: order.salesOrderId,
          }
        }

        if (
          order.skuExists === true &&
          order.isItemsMatching === false &&
          order.isInventoryItems === true
        ) {
          result = {
            isManualActionRequired: true,
            isNoActionRequired: false,
            id: order.stageId,
            soId: order.salesOrderId,
          }
        }

        if (
          order.skuExists === true &&
          order.isItemsMatching === true &&
          order.isInventoryItems === true
        ) {
          result = createItemFulfillment(order)
          log.debug('item fulfillment creation result', result)
        }
      }

      //RIGHT SIDE
      if (order.orderExists === false) {
        if (order.IsOrderIdContainUA === true) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
          }
        }

        if (order.skuExists === false) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
          }
        }

        if (
          order.skuExists === true &&
          order.isInventoryItems === true &&
          order.IsOrderIdContainUA === false
        ) {
          log.debug('creation of inventory adjustment', true)
          result = createInventoryAdjustment(order)
        }

        if (
          order.skuExists === true &&
          order.isInventoryItems === false
        ) {
          result = {
            isManualActionRequired: false,
            isNoActionRequired: true,
            id: order.stageId,
          }
        }
      }

      context.write({ key: key, value: result })
    } catch (error) {
      log.debug('key', order.stageId)

      log.debug('error - reduce - message', error.message)
      log.debug('error - reduce - stack trace', error.stack)
    }
  }

  const orderData = (lineData) => {
    const orderDetails = []
    const orderLineData = []
    lineData.forEach((line) => {
      orderLineData.push({
        item: line.Ordered_Item || line.STYLE,
        qty: line.Box_Qty || line.QUANTITY_SHIPPED,
      })
    })

    orderLineData.forEach((orderLine) => {
      const tempItem = getItem(orderLine.item)
      orderDetails.push({
        item: orderLine.item,
        itemId: tempItem.id,
        itemType: tempItem.type,
        qty: orderLine.qty,
      })
    })

    return orderDetails
  }

  const getItem = (sku) => {
    let itemId = {}
    search
      .create({
        type: search.Type.ITEM,
        filters: [
          {
            name: 'name',
            operator: search.Operator.IS,
            values: [sku],
          },
          {
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false,
          },
        ],
        columns: [{ name: 'internalid' }, { name: 'type' }],
      })
      .run()
      .each((accessory) => {
        itemId.id = accessory.getValue({ name: 'internalid' })
        itemId.type = accessory.getValue({ name: 'type' })
        return true
      })
    return itemId
  }

  const parseDate = (date) => {
    if (date.length === 8) {
      return `${date.slice(4, 6)}/${date.slice(6, 8)}/${date.slice(
        0,
        4,
      )}`
    }

    if (date.length === 11 || date.length === 9) {
      return date
    }
  }

  const getSalesOrder = (id) => {
    try {
      let soId
      search
        .create({
          type: search.Type.TRANSACTION,
          filters: [
            {
              name: 'otherrefnum',
              operator: search.Operator.EQUALTO,
              values: [id],
            },
            {
              name: 'type',
              operator: search.Operator.ANYOF,
              values: ['SalesOrd'],
            },
            {
              name: 'mainline',
              operator: search.Operator.IS,
              values: true,
            },
            {
              name: 'status',
              operator: search.Operator.ANYOF,
              values: ['SalesOrd:B', 'SalesOrd:E', 'SalesOrd:D'],
            },
          ],
          columns: [{ name: 'internalid' }],
        })
        .run()
        .each((salesOrder) => {
          soId = salesOrder.getValue({ name: 'internalid' })
          return false
        })
      return soId
    } catch (error) {
      log.debug('error fetching sales order', error)
    }
  }

  const getSalesOrderLines = (salesOrderId) => {
    try {
      if (salesOrderId) {
        const soLines = []
        const salesOrder = record.load({
          type: record.Type.SALES_ORDER,
          id: salesOrderId,
          isDynamic: true,
        })

        let lineCount = salesOrder.getLineCount({ sublistId: 'item' })
        for (var i = 0; i < lineCount; i += 1) {
          soLines.push({
            itemName: salesOrder.getSublistText({
              sublistId: 'item',
              fieldId: 'item',
              line: i,
            }),
            itemId: salesOrder.getSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: i,
            }),
            itemType: salesOrder.getSublistValue({
              sublistId: 'item',
              fieldId: 'itemtype',
              line: i,
            }),
            itemQty: parseInt(
              salesOrder.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: i,
              }),
            ),
            qtyFilled: parseInt(
              salesOrder.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantityfulfilled',
                line: i,
              }),
            ),
          })
        }

        return soLines
      }
    } catch (error) {
      log.debug('error - getSalesOrderLines', error)
    }
  }

  const getMatchingItems = (shipConfirmLines, salesOrderLines) => {
    return shipConfirmLines.filter((shipLine) =>
      salesOrderLines.some(
        (orderLine) => orderLine.itemId === shipLine.itemId,
      ),
    )
  }

  const getUniqueItems = (
    matchingItems,
    shipConfirmLines,
    salesOrderLines,
  ) => {
    return shipConfirmLines.filter(
      (shipLine) =>
        !matchingItems.some(
          (matchingItem) => matchingItem.itemId === shipLine.itemId,
        ),
    )
  }

  const removeDefaultItems = (uniqueItems) => {
    const defaultItems = ['1100', '49']
    const temp = uniqueItems.filter(
      (item) =>
        !(
          defaultItems.includes(item.itemId) &&
          defaultItems.includes(item.itemId)
        ),
    )
    if (temp.length === 0) return []
    if (temp.length > 0) return temp
  }

  const getLocation = (locale) => {
    if (locale) {
      const locations = [
        {
          name: 'GIL_EAST',
          id: 20,
        },
        {
          name: 'GIL_SW',
          id: 135,
        },
        {
          name: 'EXT_WEST',
          id: 17,
        },
      ]

      return locations.filter(
        (location) => location.name === locale,
      )[0].id
    }
  }

  const createItemFulfillment = (order) => {
    let response = {}
    response.errors = []
    response.id = order.stageId
    try {
      let fulfillmentRec = record.transform({
        fromType: record.Type.SALES_ORDER,
        fromId: order.salesOrderId,
        toType: record.Type.ITEM_FULFILLMENT,
        isDynamic: true,
      })

      fulfillmentRec.setValue({
        fieldId: 'trandate',
        value: new Date(parseDate(order.shipDate)),
      })

      fulfillmentRec.setValue({
        fieldId: 'externalid',
        value: `IF_${order.orderId}_${order.trackingNum}`,
      })

      fulfillmentRec.setValue({
        fieldId: 'memo',
        value: `${order.orderId}_${order.trackingNum}`,
      })

      var lineCount = fulfillmentRec.getLineCount({
        sublistId: 'item',
      })
      for (var i = 0; i < lineCount; i++) {
        fulfillmentRec.selectLine({ sublistId: 'item', line: i })
        fulfillmentRec.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'itemreceive',
          value: false,
        })
        fulfillmentRec.commitLine({ sublistId: 'item' })
      }

      // TAX ITEM LOGIC
      let taxLine = fulfillmentRec.findSublistLineWithValue({
        sublistId: 'item',
        fieldId: 'item',
        value: 1100,
      })

      // TAX ITEM FOUND
      if (taxLine !== -1) {
        let location = order.location
        fulfillmentRec.selectLine({
          sublistId: 'item',
          line: taxLine,
        })
        fulfillmentRec.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'itemreceive',
          value: true,
        })
        fulfillmentRec.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          value: location,
        })
        fulfillmentRec.commitLine({ sublistId: 'item' })
      }

      order.shipConfirmLines.forEach((line) => {
        let tempLine = fulfillmentRec.findSublistLineWithValue({
          sublistId: 'item',
          fieldId: 'item',
          value: line.itemId,
        })

        // ITEM WAS FOUND
        if (tempLine !== -1) {
          fulfillmentRec.selectLine({
            sublistId: 'item',
            line: tempLine,
          })
          fulfillmentRec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'itemreceive',
            value: true,
          })
          fulfillmentRec.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: order.location,
          })
          fulfillmentRec.commitLine({ sublistId: 'item' })
        }
      })

      let tranId = fulfillmentRec.save()
      if (tranId) {
        response.isSuccess = true
        response.tranId = tranId
        response.soId = order.salesOrderId
        return response
      }
    } catch (error) {
      log.debug('error - generating item fulfillment', error)
      response.isSuccess = false
      response.errors.push(error)
      return response
    }
  }

  const createInventoryAdjustment = (order) => {
    let response = {}
    response.id = order.stageId
    response.errors = []

    try {
      let inventoryAdjustment = record.create({
        type: record.Type.INVENTORY_ADJUSTMENT,
        isDynamic: true,
      })

      inventoryAdjustment.setValue({
        fieldId: 'subsidiary',
        value: 1,
      })

      inventoryAdjustment.setValue({
        fieldId: 'externalid',
        value: `INVADJ_${order.orderId}_${order.trackingNum}`,
      })

      inventoryAdjustment.setValue({
        fieldId: 'account',
        value: 872,
      })
      inventoryAdjustment.setValue({
        fieldId: 'memo',
        value: `${order.orderId}_${order.trackingNum}`,
      })
      inventoryAdjustment.setValue({
        fieldId: 'trandate',
        value: new Date(parseDate(order.shipDate)),
      })

      const inventoryItems = order.shipConfirmLines.filter(
        (shipLine) =>
          shipLine.itemType === 'InvtPart' ||
          shipLine.itemType === 'Assembly',
      )

      if (inventoryItems.length > 0) {
        inventoryItems.forEach((line) => {
          inventoryAdjustment.selectNewLine({
            sublistId: 'inventory',
          })
          inventoryAdjustment.setCurrentSublistValue({
            sublistId: 'inventory',
            fieldId: 'item',
            value: line.itemId,
          })
          inventoryAdjustment.setCurrentSublistValue({
            sublistId: 'inventory',
            fieldId: 'location',
            value: order.location,
          })
          inventoryAdjustment.setCurrentSublistValue({
            sublistId: 'inventory',
            fieldId: 'adjustqtyby',
            value: -parseInt(line.qty),
          })
          inventoryAdjustment.commitLine({ sublistId: 'inventory' })
        })
      }
      let adjustId = inventoryAdjustment.save()

      if (adjustId) {
        response.tranId = adjustId
        response.isSuccess = true
        response.soId = null
        return response
      }
    } catch (e) {
      log.debug('error - inventory adjustment', e)
      response.errors.push(e)
      response.isSuccess = false
      return response
    }
  }

  /**
   *
   * @param {*} summary
   * status ids:
   * 1 - Pending
   * 5 - Success
   * 3 - Error - Manual Action Required
   * 4 - No Action Required
   * 6 - Failed
   */

  const summarize = (summary) => {
    let success = [],
      failure = [],
      isManualActionRequired = [],
      isNoActionRequired = []

    summary.output.iterator().each((key, value) => {
      if (value !== 'undefined') {
        value = JSON.parse(value)
      }

      if (value.isSuccess === true) {
        success.push({ id: value.id, data: value })
      }

      if (value.isSuccess === false) {
        failure.push({
          id: value.id,
          data: value,
          errors: value.errors,
        })
      }

      if (value.isManualActionRequired === true) {
        isManualActionRequired.push({ id: value.id, data: value })
      }

      if (value.isNoActionRequired === true) {
        isNoActionRequired.push({ id: value.id, data: value })
      }

      return true
    })

    if (success.length > 0) {
      success.forEach((stage) => {
        updateStagingRecord(stage, 5, null)
      })
    }

    if (failure.length > 0) {
      failure.forEach((stage) => {
        updateStagingRecord(stage, 6, stage.errors)
      })
    }

    if (isManualActionRequired.length > 0) {
      isManualActionRequired.forEach((stage) => {
        updateStagingRecord(stage, 3, null)
      })
    }

    if (isNoActionRequired.length > 0) {
      isNoActionRequired.forEach((stage) => {
        updateStagingRecord(stage, 4, null)
      })
    }
  }

  const updateStagingRecord = (stage, status, errors) => {
    const stageRecord = record.load({
      type: 'customrecord_accessory_staging',
      id: stage.id,
      isDynamic: true,
    })

    stageRecord.setValue({
      fieldId: 'custrecord_stg_status',
      value: status,
    })

    stageRecord.setValue({
      fieldId: 'custrecord_stg_date_process',
      value: new Date(),
    })

    if (errors) {
      stageRecord.setValue({
        fieldId: 'custrecord_stg_errors',
        value: JSON.stringify(errors),
      })
    }

    if (stage.data.soId) {
      stageRecord.setValue({
        fieldId: 'custrecord_stg_sales_order',
        value: stage.data.soId,
      })
    }

    if (stage.data.tranId) {
      stageRecord.setValue({
        fieldId: 'custrecord_stg_rel_trans',
        value: stage.data.tranId,
      })
    }

    stageRecord.save()
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
