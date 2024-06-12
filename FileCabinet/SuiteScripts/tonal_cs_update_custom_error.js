/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/record'], function (
  currentRecord,
  record,
) {
  const updateCustomRecord = () => {
    let salesOrder = currentRecord.get()

    let errorId = salesOrder.getValue({
      fieldId: 'custbody_error_record',
    })

    updateCustomRecord(errorId)
    updateSalesOrder(salesOrder.id)
  }

  const updateSalesOrder = (soid) => {
    let salesOrder = record.load({
      type: record.Type.SALES_ORDER,
      id: soid,
    })

    salesOrder.setValue({
      fieldId: 'custbody_invoice_error',
      value: false,
    })
    salesOrder.save()
  }

  const updateCustomRecord = (errorId) => {
    const customRec = record.load({
      type: 'customrecord_errors_invoice',
      id: errorId,
      isDynamic: true,
    })

    customRec.setValue({
      fieldId: 'custrecord_error_status',
      value: 2,
    })
    customRec.setValue({
      fieldId: 'custrecord_error_processed_date',
      value: new Date(),
    })
    customRec.save()
  }

  return {
    updateCustomRecord: updateCustomRecord,
  }
})
