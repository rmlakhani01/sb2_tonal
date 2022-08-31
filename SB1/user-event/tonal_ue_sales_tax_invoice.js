/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/record'], function (record) {
  const afterSubmit = (context) => {
    let responseArray
    if (context.type === 'create') {
      responseArray = taxInvoice(context.newRecord.id)
      if (
        responseArray[0].invoiceid &&
        responseArray[0].invoiceid !== null
      ) {
        if (responseArray[0].isSuccess === true) {
          updateSalesOrder(
            context.newRecord.id,
            responseArray[0].isSuccess,
            responseArray,
          )
        }

        if (responseArray[0].isSuccess === false) {
          updateSalesOrder(
            context.newRecord.id,
            responseArray[0].isSuccess,
            responseArray,
          )
        }
      }
    }

    if (context.type === 'edit') {
      let createNewTaxInvoice = context.newRecord.getValue({
        fieldId: 'custbody_trigger_reprocess',
      })
      if (createNewTaxInvoice === true) {
        responseArray = taxInvoice(context.newRecord.id)
        if (
          responseArray[0].invoiceid &&
          responseArray[0].invoiceid !== null
        ) {
          if (responseArray[0].isSuccess === true) {
            updateSalesOrder(
              context.newRecord.id,
              responseArray[0].isSuccess,
              responseArray,
            )
          }

          if (responseArray[0].isSuccess === false) {
            updateSalesOrder(
              context.newRecord.id,
              responseArray[0].isSuccess,
              responseArray,
            )
          }
        }
      }
    }
  }

  const taxInvoice = (salesOrderId) => {
    let response = []
    try {
      let isSuccess = false
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

      log.debug(
        'TOTAL LINE COUNT - BEFORE REMOVING A LINE',
        lineCount,
      )

      // extract the non tax items
      for (var i = 0; i != lineCount; i++) {
        log.debug(
          'LINE COUNT',
          invoiceRecord.getLineCount({ sublistId: 'item' }),
        )
        log.debug('ITERATOR', i)
        var itemId = invoiceRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i,
        })
        log.debug('ITEM', itemId)
        var lineNum = invoiceRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'line',
          line: i,
        })
        log.debug('LINE NUMBER', lineNum)

        if (itemId != taxItem) {
          invoiceRecord.removeLine({
            sublistId: 'item',
            line: i,
          })
          log.debug('LINE REMOVED', '-------')
          lineCount--
          i--
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
        let invoiceObj = {
          isSuccess: true,
          invoiceid: invoiceId,
          errors: {},
        }
        response.push(invoiceObj)
      }
    } catch (e) {
      let invoiceObj = {
        isSuccess: false,
        invoiceid: null,
        errors: {
          invoice: e.message,
        },
      }
      response.push(invoiceObj)
    }
    return response
  }

  const updateSalesOrder = (
    salesOrderId,
    isSuccess,
    responseArray,
  ) => {
    log.debug('RESPONSE ARRAY', responseArray)
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

    if (isSuccess === false) {
    }
  }

  return {
    afterSubmit: afterSubmit,
  }
})
