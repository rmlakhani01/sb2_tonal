/**
 *@NApiVersion 2.1
 */
define(['N/currentRecord'], function (currentRecord) {
  const updateCustomRecord = () => {
    let record = currentRecord.get()
    alert('record', record)
  }

  return {
    updateCustomRecord: updateCustomRecord,
  }
})
