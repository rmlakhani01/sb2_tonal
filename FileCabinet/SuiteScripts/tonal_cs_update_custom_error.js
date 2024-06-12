/**
 *@NApiVersion 2.1
 */
define(['N/currentRecord', 'N/record'], function (
  currentRecord,
  record,
) {
  const updateCustomRecord = () => {
    let currentRec = currentRecord.get()
    alert('currentRec', currentRec)
    alert('currentRec.type', currentRec.type)
    const customRec = record.load({
      type: currentRec.type,
      id: currentRec.id,
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

    currentRec.setValue({
      fieldId: 'custbody_invoice_error',
      value: false,
    })
  }

  return {
    updateCustomRecord: updateCustomRecord,
  }
})
