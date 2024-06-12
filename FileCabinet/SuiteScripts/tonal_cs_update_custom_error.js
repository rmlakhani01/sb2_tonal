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

    updateErrorCustomRecord(errorId)
    updateSalesOrder(salesOrder.id)
    location.reload()
  }

  const updateSalesOrder = (soid) => {
    record.submitFields({
      type: record.Type.SALES_ORDER,
      id: soid,
      values: {
        custbody_invoice_error: false,
        custbody_error_record: null,
      },
    })
  }

  const updateErrorCustomRecord = (errorId) => {
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
