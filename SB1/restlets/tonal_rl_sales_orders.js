/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/search', 'N/runtime'], function (search, runtime) {
  function _get(context) {
    const results = []
    const savedSearchId = runtime
      .getCurrentScript()
      .getParameter({ name: 'custscript_sales_order_search' })

    const savedSearchObj = search.load({ id: savedSearchId })
    savedSearchObj.run().each((result) => {
      let order = {
        salesOrderId: result.getValue({ name: 'internalId' }),
        customerId: result.getValue({ name: 'entity' }),
        wooCommerceId: result.getValue({ name: 'otherrefnum' }),
      }
      results.push(order)
      return true
    })

    return JSON.stringify(results)
  }

  return {
    get: _get,
  }
})
