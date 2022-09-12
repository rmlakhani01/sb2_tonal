/**
 * @NApiVersion 2.1
 */
define(['N/record'], function (record) {
  const updateTransaction = (recordObject) => {
    if (recordObject.sourceRecordType === 'salesorder') {
      let salesOrder = record.load({
        type: record.Type.SALES_ORDER,
        id: recordObject.sourceRecordId,
      })

      salesOrder.setValue({
        fieldId: 'custbody_processed_dt',
        value: '',
      })
      salesOrder.setValue({
        fieldId: 'custbody_error_description',
        value: '[' + new Date() + '] - ' + recordObject.errors,
      })
      salesOrder.save()
    }

    if (recordObject.sourceRecordType === 'customerdeposit') {
      log.debug('customerdeposit', recordObject)
      let customerDeposit = record.load({
        type: record.Type.CUSTOMER_DEPOSIT,
        id: recordObject.sourceRecordId,
      })

      customerDeposit.setValue({
        fieldId: 'custbody_processed_dt',
        value: '',
      })

      customerDeposit.setValue({
        fieldId: 'custbody_error_description',
        value: '[' + new Date() + '] - ' + recordObject.errors,
      })
      customerDeposit.save()
    }
  }
  return {
    updateTransaction: updateTransaction,
  }
})
