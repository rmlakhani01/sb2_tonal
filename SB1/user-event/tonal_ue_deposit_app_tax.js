/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record', './lib_retry_mechanism'], function (
  search,
  record,
  libRetry,
) {
  const afterSubmit = (context) => {
    if (context.type === 'create') {
      let soId = context.newRecord.getValue({ fieldId: 'salesorder' })
      const invoices = taxInvoice(soId)
      if (invoices && invoices.length > 0) {
        let recordObject = applyDeposit(
          invoices,
          context.newRecord.id,
        )
        recordObject.isSuccess === true
          ? updateCustomerDeposit(context.newRecord.id)
          : libRetry.updateTransaction
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
        const invoices = taxInvoice(soId)
        if (invoices && invoices.length > 0) {
          let recordObject = applyDeposit(
            invoices,
            context.newRecord.id,
          )
          recordObject.isSuccess === true
            ? updateCustomerDeposit(context.newRecord.id)
            : libRetry.updateTransaction
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

  const updateCustomerDeposit = (custDepId) => {
    let custDepRecord = record.load({
      type: record.Type.CUSTOMER_DEPOSIT,
      id: custDepId,
    })

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

  return {
    afterSubmit: afterSubmit,
  }
})
