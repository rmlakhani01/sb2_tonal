/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/ui/serverWidget'], function (_serverWidget) {
  function beforeLoad(context) {
    const currentForm = context.form

    const hasInvoiceError = context.newRecord.getValue({
      fieldId: 'custbody_invoice_error',
    })

    const salesOrderStatus = context.newRecord.getValue({
      fieldId: 'orderstatus',
    })

    const errorId = context.newRecord.getValue({
      fieldId: 'custbody_error_record',
    })

    if (
      hasInvoiceError &&
      hasInvoiceError === true &&
      salesOrderStatus === 'F'
    ) {
      currentForm.clientScriptModulePath =
        './tonal_cs_update_custom_error.js'

      currentForm.addButton({
        id: 'custpage_invoice_error_handler',
        label: 'Process Invoice Error',
        functionName: `updateCustomRecord(${errorId})`,
      })
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
