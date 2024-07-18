/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record'], function (search, record) {
  const getInputData = () => {
    const results = []
    search
      .create({
        type: 'customrecord_accessory_staging',
        filters: [
          {
            name: 'custrecord_stg_status',
            operator: search.Operator.IS,
            values: ['7'],
          },
          {
            name: 'isinactive',
            operator: search.Operator.IS,
            values: false,
          },
        ],
        columns: [
          { name: 'internalid' },
          { name: 'custrecord_stg_status' },
          { name: 'custrecord_stg_lines' },
          { name: 'custrecord_stg_sales_order' },
          { name: 'custrecord_stg_order_id' },
        ],
      })
      .run()
      .each((result) => {
        results.push({
          id: result.getValue({ name: 'internalid' }),
          status: result.getValue({ name: 'custrecord_stg_status' }),
          lines: result.getValue({
            name: 'custrecord_stg_lines',
          }),
          salesOrder: result.getValue({
            name: 'custrecord_stg_sales_order',
          }),
          orderId: result.getValue({
            name: 'custrecord_stg_order_id',
          }),
        })
        return true
      })

    log.debug('Number of results: ', results.length)
    return results
  }

  const map = (context) => {
    const data = JSON.parse(context.value)
    context.write({ key: data.orderId, value: data })
  }

  const reduce = (context) => {
    const key = context.key
    const data = JSON.parse(context.values)
    log.debug('key: ', key)
    log.debug('data: ', data)
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

  const summarize = (summary) => {}

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
