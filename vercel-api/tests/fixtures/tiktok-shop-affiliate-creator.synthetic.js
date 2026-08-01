const ACCOUNT_A = "10000000-0000-4000-8000-000000000001";
const ACCOUNT_B = "20000000-0000-4000-8000-000000000002";

module.exports = Object.freeze({
  ACCOUNT_A,
  ACCOUNT_B,
  binding: Object.freeze({
    id: "30000000-0000-4000-8000-000000000003",
    creatorAccountId: ACCOUNT_A,
    providerCreatorId: null,
    state: "disabled"
  }),
  collaboration: Object.freeze({
    id: "40000000-0000-4000-8000-000000000004",
    creatorAccountId: ACCOUNT_A,
    providerRecordId: "synthetic-collaboration-1",
    collaborationType: "synthetic_target",
    status: null,
    title: "Synthetic collaboration",
    startedAt: null,
    endedAt: null
  }),
  product: Object.freeze({
    id: "50000000-0000-4000-8000-000000000005",
    creatorAccountId: ACCOUNT_A,
    providerRecordId: "synthetic-product-1",
    title: "Synthetic product",
    showcaseStatus: null,
    currency: null,
    priceMinor: null,
    commissionRateBasisPoints: null
  }),
  sample: Object.freeze({
    id: "60000000-0000-4000-8000-000000000006",
    creatorAccountId: ACCOUNT_A,
    providerRecordId: "synthetic-sample-1",
    productProviderId: "synthetic-product-1",
    applicationType: null,
    status: null
  }),
  order: Object.freeze({
    id: "70000000-0000-4000-8000-000000000007",
    creatorAccountId: ACCOUNT_A,
    providerRecordId: "synthetic-order-1",
    productProviderId: "synthetic-product-1",
    createdAt: "2024-02-01T18:00:00.000Z",
    status: null,
    quantity: null,
    currency: null,
    gmvMinor: null,
    estimatedCommissionMinor: null,
    finalCommissionMinor: null,
    refundMinor: null,
    settledAt: null
  }),
  attribution: Object.freeze({
    id: "80000000-0000-4000-8000-000000000008",
    creatorAccountId: ACCOUNT_A,
    providerRecordId: "synthetic-attribution-1",
    orderProviderId: "synthetic-order-1",
    attributionType: null,
    contentProviderId: null
  })
});
