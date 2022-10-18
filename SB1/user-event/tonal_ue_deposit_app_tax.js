/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define([
  'N/search',
  'N/record',
  './lib_retry_mechanism',
  'N/runtime',
], function (search, record, libRetry, runtime) {
  const afterSubmit = (context) => {
    if (
      context.type === 'create' &&
      runtime.executionContext === 'RESTLET'
    ) {
      log.debug('runtime context', runtime.executionContext)
      let soId = context.newRecord.getValue({ fieldId: 'salesorder' })
      let fee = context.newRecord.getValue({
        fieldId: 'custbody_payment_fee',
      })
      let memo = context.newRecord.getValue({ fieldId: 'memo' })
      const invoices = taxInvoice(soId)
      if (invoices && invoices.length > 0) {
        let recordObject = applyDeposit(
          invoices,
          context.newRecord.id,
        )
        if (
          recordObject.isSuccess === true &&
          recordObject.destinationRecordId
        ) {
          let recordObject = createJournalEntry(
            memo,
            fee,
            context.newRecord.id,
          )

          if (recordObject.isSuccess === true)
            updateCustomerDeposit(recordObject)
          if (recordObject.isSuccess === false)
            libRetry.updateTransaction(recordObject)
        }
      }

      if (invoices && invoices.length === 0) {
        let recordObject = {}
        recordObject.isSuccess = false
        recordObject.errors =
          'Invoice not found. Deposit application cannot be generated.'
        recordObject.sourceRecordType = record.Type.CUSTOMER_DEPOSIT
        recordObject.sourceRecordId = context.newRecord.id
        recordObject.destinationRecordType =
          record.Type.DEPOSIT_APPLICATION
        recordObject.destinationRecordId = null

        libRetry.updateTransaction(recordObject)
        return
      }
    }

    if (context.type === 'edit') {
      if (
        context.newRecord.getValue({
          fieldId: 'custbody_trigger_reprocess',
        }) === true
      ) {
        let soId = context.newRecord.getValue({
          fieldId: 'salesorder',
        })
        let fee = context.newRecord.getValue({
          fieldId: 'custbody_payment_fee',
        })
        let memo = context.newRecord.getValue({ fieldId: 'memo' })
        const invoices = taxInvoice(soId)
        if (invoices && invoices.length > 0) {
          let recordObject = applyDeposit(
            invoices,
            context.newRecord.id,
          )

          if (
            recordObject.isSuccess === true &&
            recordObject.destinationRecordId
          ) {
            let recordObject = createJournalEntry(
              memo,
              fee,
              context.newRecord.id,
            )

            if (recordObject.isSuccess === true)
              updateCustomerDeposit(recordObject)
            if (recordObject.isSuccess === false)
              libRetry.updateTransaction(recordObject)
          }
        }

        if (invoices && invoices.length === 0) {
          let recordObject = {}
          recordObject.isSuccess = false
          recordObject.errors =
            'Invoice not found. Deposit application cannot be generated.'
          recordObject.sourceRecordType = record.Type.CUSTOMER_DEPOSIT
          recordObject.sourceRecordId = context.newRecord.id
          recordObject.destinationRecordType =
            record.Type.DEPOSIT_APPLICATION
          recordObject.destinationRecordId = null

          libRetry.updateTransaction(recordObject)
          return
        }
      }
    }
  }

  // get the existing invoice that is related to the sales order.
  const taxInvoice = (soId) => {
    const taxInvoices = []
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'CustInvc',
          },
          {
            name: 'createdfrom',
            operator: search.Operator.ANYOF,
            values: [soId],
          },
          {
            name: 'mainline',
            operator: search.Operator.IS,
            values: true,
          },
          {
            name: 'status',
            operator: search.Operator.ANYOF,
            values: ['CustInvc:A'],
          },
        ],
        columns: [
          {
            name: 'internalid',
          },
          {
            name: 'tranid',
          },
          {
            name: 'amount',
          },
        ],
      })
      .run()
      .each((result) => {
        let r = {
          internalid: result.getValue({ name: 'internalid' }),
          docNumber: result.getValue({ name: 'tranid' }),
          amount: result.getValue({ name: 'amount' }),
        }

        taxInvoices.push(r)
        return true
      })

    return taxInvoices
  }

  // marks the invoice as applied.
  const applyDeposit = (invoices, customerDepositId) => {
    try {
      let recordObject = {}
      let depositApplication = record.transform({
        fromType: record.Type.CUSTOMER_DEPOSIT,
        fromId: customerDepositId,
        toType: record.Type.DEPOSIT_APPLICATION,
        isDynamic: true,
      })

      let matchingInvoiceLineNumber =
        depositApplication.findSublistLineWithValue({
          sublistId: 'apply',
          fieldId: 'refnum',
          value: invoices[0].docNumber,
        })

      depositApplication.selectLine({
        sublistId: 'apply',
        line: matchingInvoiceLineNumber,
      })
      depositApplication.setCurrentSublistValue({
        sublistId: 'apply',
        fieldId: 'apply',
        value: true,
      })
      depositApplication.commitLine({ sublistId: 'apply' })

      let depId = depositApplication.save()
      if (depId) {
        ;(recordObject.isSuccess = true),
          (recordObject.sourceRecordType =
            record.Type.CUSTOMER_DEPOSIT),
          (recordObject.sourceRecordId = customerDepositId)
        ;(recordObject.destinationRecordType =
          record.Type.DEPOSIT_APPLICATION),
          (recordObject.destinationRecordId = depId)
      }

      return recordObject
    } catch (e) {
      let recordObject = {}
      recordObject.isSuccess = false
      recordObject.errors = e
      recordObject.sourceRecordType = record.Type.CUSTOMER_DEPOSIT
      recordObject.sourceRecordId = customerDepositId
      recordObject.destinationRecordType =
        record.Type.DEPOSIT_APPLICATION
      recordObject.destinationRecordId = null

      return recordObject
    }
  }

  // updates the record once the deposit application has been successfully applied.
  const updateCustomerDeposit = (recordObject) => {
    let custDepRecord = record.load({
      type: record.Type.CUSTOMER_DEPOSIT,
      id: recordObject.sourceRecordId,
    })

    if (
      recordObject.destinationRecordType === 'journalentry' &&
      recordObject.destinationRecordId !== null
    ) {
      custDepRecord.setValue({
        fieldId: 'custbody_merchant_fee_je_1',
        value: recordObject.destinationRecordId,
      })
    }

    custDepRecord.setValue({
      fieldId: 'custbody_processed_dt',
      value: new Date(),
    })
    custDepRecord.setValue({
      fieldId: 'custbody_trigger_reprocess',
      value: false,
    })
    custDepRecord.setValue({
      fieldId: 'custbody_error_description',
      value: null,
    })
    custDepRecord.save()
  }

  const createJournalEntry = (memo, feeAmount, custDepId) => {
    try {
      let recordObject = {}
      let debitAccount = runtime
        .getCurrentScript()
        .getParameter({ name: 'custscript_deferred_affirm_account' })

      let creditAccount = runtime
        .getCurrentScript()
        .getParameter({ name: 'custscript_affirm_account' })

      let journalRecord = record.create({
        type: record.Type.JOURNAL_ENTRY,
        isDynamic: true,
      })

      journalRecord.setValue({ fieldId: 'approvalstatus', value: 2 })
      journalRecord.setValue({ fieldId: 'subsidiary', value: 1 })
      journalRecord.setValue({ fieldId: 'memo', value: memo })
      journalRecord.insertLine({ sublistId: 'line', line: 0 })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'account',
        value: debitAccount,
      })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'debit',
        value: feeAmount,
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
        value: feeAmount,
      })
      journalRecord.commitLine({ sublistId: 'line' })

      let journalId = journalRecord.save()
      if (journalId) {
        recordObject.isSuccess = true
        recordObject.sourceRecordType = record.Type.CUSTOMER_DEPOSIT
        recordObject.sourceRecordId = custDepId
        recordObject.destinationRecordType = record.Type.JOURNAL_ENTRY
        recordObject.destinationRecordId = journalId
      }
      return recordObject
    } catch (e) {
      log.debug('exception caught')
      let recordObject = {
        isSuccess: false,
        errors:
          'Journal entry was not created successfully. Reason: ' +
          e.message,
        sourceRecordType: record.Type.CUSTOMER_DEPOSIT,
        sourceRecordId: custDepId,
        destinationRecordType: record.Type.JOURNAL_ENTRY,
        destinationRecordId: null,
      }
      return recordObject
    }
  }

  return {
    afterSubmit: afterSubmit,
  }
})
