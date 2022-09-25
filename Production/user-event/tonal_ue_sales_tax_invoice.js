/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record', './lib_retry_mechanism'], function (
  record,
  libRetry,
) {
  const afterSubmit = (context) => {
    if (context.type === 'create') {
      let recordObject = taxInvoice(context.newRecord.id)

      recordObject.isSuccess === true
        ? updateSalesOrder(
            context.newRecord.id,
            recordObject.isSuccess,
          )
        : libRetry.updateTransaction(recordObject)
    }

    if (context.type === 'edit') {
      let createNewTaxInvoice = context.newRecord.getValue({
        fieldId: 'custbody_trigger_reprocess',
      })

      if (createNewTaxInvoice === true) {
        let recordObject = taxInvoice(context.newRecord.id)

        recordObject.isSuccess === true
          ? updateSalesOrder(
              context.newRecord.id,
              recordObject.isSuccess,
            )
          : libRetry.updateTransaction(recordObject)
      }
    }
  }

  const taxInvoice = (salesOrderId) => {
    try {
      let recordObject = {}
      recordObject.isSuccess = false
      const taxItem = 1100
      let invoiceRecord = record.transform({
        fromType: record.Type.SALES_ORDER,
        fromId: salesOrderId,
        toType: record.Type.INVOICE,
        isDynamic: true,
      })

      let lineCount = invoiceRecord.getLineCount({
        sublistId: 'item',
      })

      // extract the non tax items
      for (var i = 0; i != lineCount; i++) {
        var itemId = invoiceRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i,
        })

        if (itemId != taxItem) {
          invoiceRecord.removeLine({
            sublistId: 'item',
            line: i,
          })
          lineCount--
          i--
        }

        let lineNum = invoiceRecord.findSublistLineWithValue({
          sublistId: 'item',
          fieldId: 'item',
          value: taxItem,
        })

        if (lineNum === -1) {
          recordObject.isSuccess = false
          recordObject.errors =
            'Sales Tax Item not found on transaction'
          ;(recordObject.sourceRecordType = record.Type.SALES_ORDER),
            (recordObject.sourceRecordId = salesOrderId)
          ;(recordObject.destinationRecordType = record.Type.INVOICE),
            (recordObject.destinationRecordId = null)
          return recordObject
        }

        if (itemId == taxItem) {
          invoiceRecord.selectLine({ sublistId: 'item', line: i })
          invoiceRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          invoiceRecord.commitLine({ sublistId: 'item' })
        }
      }

      let invoiceId = invoiceRecord.save()

      if (invoiceId) {
        recordObject.isSuccess = true
        ;(recordObject.sourceRecordType = record.Type.SALES_ORDER),
          (recordObject.sourceRecordId = salesOrderId)
        ;(recordObject.destinationRecordType = record.Type.INVOICE),
          (recordObject.destinationRecordId = invoiceId)
      }

      return recordObject
    } catch (e) {
      let recordObject = {}
      recordObject.isSuccess = false
      recordObject.errors = e
      ;(recordObject.sourceRecordType = record.Type.SALES_ORDER),
        (recordObject.sourceRecordId = salesOrderId)
      ;(recordObject.destinationRecordType = record.Type.INVOICE),
        (recordObject.destinationRecordId = null)
      return recordObject
    }
  }

  const updateSalesOrder = (salesOrderId, isSuccess) => {
    if (isSuccess === true) {
      let salesOrder = record.load({
        type: record.Type.SALES_ORDER,
        id: salesOrderId,
      })

      salesOrder.setValue({
        fieldId: 'custbody_processed_dt',
        value: new Date(),
      })

      salesOrder.setValue({
        fieldId: 'custbody_trigger_reprocess',
        value: false,
      })

      salesOrder.setValue({
        fieldId: 'custbody_error_description',
        value: null,
      })

      salesOrder.save()
    }
  }

  return {
    afterSubmit: afterSubmit,
  }
})
