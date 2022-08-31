/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {
  function saveRecord(context) {
    const currentRecord = context.currentRecord
    const fieldValue = currentRecord.getValue({
      fieldId: 'custbody_to_classification',
    })

    if (fieldValue == 2) {
      alert('Please specify the sales order on all lines.')
      return false
    } else {
      return true
    }
  }

  return {
    saveRecord: saveRecord,
  }
})
