/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record'], function (record) {
  const afterSubmit = (context) => {
    try {
      const taxAmount = context.newRecord.getValue({
        fieldId: 'custbody_payment_tax',
      })
      const salesOrderId = context.newRecord.getValue({
        fieldId: 'salesorder',
      })

      log.debug('taxAmount', taxAmount)
      log.debug('salesOrderId', salesOrderId)

      if (salesOrderId) {
        if (taxAmount && taxAmount !== null) {
          let salesOrder = record.load({
            type: record.Type.SALES_ORDER,
            id: salesOrderId,
            isDynamic: true,
          })

          let lines = salesOrder.getLineCount({ sublistId: 'item' })
          let doesTaxExist = false

          for (let i = 0; i < lines; i++) {
            let index = salesOrder.findSublistLineWithValue({
              sublistId: 'item',
              fieldId: 'item',
              value: 1100,
            })
            if (index !== -1) doesTaxExist = true
          }

          if (doesTaxExist === false) {
            salesOrder.selectNewLine({
              sublistId: 'item',
            })
            salesOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              value: 1100,
            })
            salesOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              value: 1,
            })
            salesOrder.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'amount',
              value: taxAmount,
            })
            salesOrder.commitLine({ sublistId: 'item' })
            salesOrder.save()
          }
        }
      }
    } catch (e) {}
  }

  return {
    afterSubmit: afterSubmit,
  }
})
