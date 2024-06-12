/**
 *@NApiVersion 2.1
 */
define(['N/currentRecord'], function (currentRecord) {
  const updateCustomRecord = (context) => {
    let record = currentRecord.get()
    alert('record', record)
  }

  return {
    updateCustomRecord: updateCustomRecord,
  }
})
