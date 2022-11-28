/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (
  search,
  record,
  runtime,
) {
  const afterSubmit = (context) => {
    try {
      let currentRecord = context.newRecord
      let recordObject = {}
      let debitAccount = runtime
        .getCurrentScript()
        .getParameter({ name: 'custscript_deferred_affirm_account' })

      let creditAccount = runtime
        .getCurrentScript()
        .getParameter({ name: 'custscript_affirm_account' })

      let salesOrder = currentRecord.getValue({
        fieldId: 'salesorder',
      })
      let salesOrderRec = record.load({
        type: record.Type.SALES_ORDER,
        id: salesOrder,
      })
      let createdDate = salesOrderRec.getValue({
        fieldId: 'createddate',
      })
      let cutOverDate = new Date('2022-11-01')

      if (
        currentRecord.getValue({ fieldId: 'paymentmethod' }) ===
          '7' &&
        createdDate > cutOverDate
      ) {
        let journalRecord = record.create({
          type: record.Type.JOURNAL_ENTRY,
          isDynamic: true,
        })

        journalRecord.setValue({
          fieldId: 'externalid',
          value: 'AJE_' + currentRecord.getValue({ fieldId: 'memo' }),
        })

        journalRecord.setValue({
          fieldId: 'approvalstatus',
          value: 2,
        })
        journalRecord.setValue({ fieldId: 'subsidiary', value: 1 })
        journalRecord.setValue({
          fieldId: 'memo',
          value: currentRecord.getValue({ fieldId: 'memo' }),
        })
        journalRecord.insertLine({ sublistId: 'line', line: 0 })
        journalRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: debitAccount,
        })
        journalRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'debit',
          value: currentRecord.getValue({
            fieldId: 'custbody_payment_fee',
          }),
        })
        journalRecord.commitLine({ sublistId: 'line' })
        journalRecord.insertLine({ sublistId: 'line', line: 1 })
        journalRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'account',
          value: creditAccount,
        })
        journalRecord.setCurrentSublistValue({
          sublistId: 'line',
          fieldId: 'credit',
          value: currentRecord.getValue({
            fieldId: 'custbody_payment_fee',
          }),
        })
        journalRecord.commitLine({ sublistId: 'line' })

        let journalId = journalRecord.save()
        if (journalId) {
          recordObject.isSuccess = true
          recordObject.sourceRecordType = record.Type.CUSTOMER_DEPOSIT
          recordObject.sourceRecordId = currentRecord.id
          recordObject.destinationRecordType =
            record.Type.JOURNAL_ENTRY
          recordObject.destinationRecordId = journalId

          record.submitFields({
            type: record.Type.CUSTOMER_DEPOSIT,
            id: currentRecord.id,
            values: {
              custbody_merchant_fee_je_1: journalId,
            },
          })
        }
        return recordObject
      }
    } catch (e) {
      let recordObject = {
        isSuccess: false,
        errors: e,
        sourceRecordType: record.Type.CUSTOMER_DEPOSIT,
        sourceRecordId: context.newRecord.id,
        destinationRecordType: record.Type.JOURNAL_ENTRY,
        destinationRecordId: null,
      }
      log.debug('recordObject', recordObject)
      log.debug('recordObject.errors', e)
      return recordObject
    }
  }

  return {
    afterSubmit: afterSubmit,
  }
})
