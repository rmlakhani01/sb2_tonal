/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/record'], function (record) {
  function pageInit(context) {
    alert('pageInit - initiated')
  }

  const updateCustomRecord = (context) => {
    alert(context.id)
  }

  return {
    pageInit: pageInit,
    updateCustomRecord: updateCustomRecord,
  }
})
