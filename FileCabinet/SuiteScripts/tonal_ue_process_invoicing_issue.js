/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (_serverWidget) {
  function beforeLoad(context) {
    const currentRecord = context.currentRecord
    const currentForm = context.form

    const hasInvoiceError = currentRecord.newRecord.getValue({
      fieldId: 'custbody_invoice_error',
    })

    if (hasInvoiceError && hasInvoiceError === true) {
      currentForm.addButton({
        id: 'custpage_invoice_error_handler',
        label: 'Process Invoice Error',
        functionName: 'updateCustomRecord',
      })
      currentForm.clientScriptFileId = '814569'
    }
  }

  function beforeSubmit(context) {}

  function afterSubmit(context) {}

  return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit,
  }
})
