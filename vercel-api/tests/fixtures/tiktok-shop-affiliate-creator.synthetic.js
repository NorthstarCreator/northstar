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
  }),
  mappingContext: Object.freeze({
    creatorAccountId: ACCOUNT_A,
    boundProviderCreatorId: "synthetic-creator-a",
    tokenProviderCreatorId: "synthetic-creator-a"
  }),
  creatorProfileResponse: Object.freeze({
    creator_user_open_id: "synthetic-creator-a",
    username: "synthetic_creator",
    selection_region: "US",
    register_region: "US",
    seller_type: null,
    permissions: Object.freeze(["synthetic-read-permission"]),
    user_type: 1,
    avatar: null
  }),
  affiliateOrderResponse: Object.freeze({
    id: "synthetic-order-2",
    create_time: 1706810400,
    delivery_time: null,
    status: "SYNTHETIC_STATUS",
    skus: Object.freeze([Object.freeze({
      id: "synthetic-sku-2",
      campaign_id: null,
      open_collaboration_id: null,
      target_collaboration_id: "synthetic-collaboration-2",
      product_name: "Synthetic mapped product",
      product_id: "synthetic-product-2",
      price: Object.freeze({ amount: "synthetic-unparsed-amount", currency: "USD" }),
      shop_name: "Synthetic shop"
    })])
  }),
  targetCollaborationResponse: Object.freeze({
    id: "synthetic-collaboration-2",
    name: "Synthetic target collaboration",
    status: null,
    products: Object.freeze([Object.freeze({
      id: "synthetic-product-2",
      title: "Synthetic mapped product",
      main_image_url: null,
      commission: Object.freeze({ rate: 1000, amount: "synthetic-unparsed-amount", currency: "USD" })
    })])
  }),
  sampleApplicationResponse: Object.freeze({
    id: "synthetic-sample-2",
    create_time: 1706810400,
    sample_product: Object.freeze({
      id: "synthetic-product-2",
      sku_id: "synthetic-sku-2",
      sku_sale_property_value_names: null
    }),
    main_order_id: null,
    activity_id: null,
    type: null,
    status: null,
    creator_fulfillment: null
  }),
  liveCoreStatsResponse: Object.freeze({
    sales: 7,
    local_gmv: Object.freeze({ amount: "synthetic-unparsed-amount", currency: "USD" }),
    created_order_count: 5,
    current_visitor_count: null,
    paid_order_count: 4,
    local_unit_price: Object.freeze({ amount: "synthetic-unparsed-amount", currency: "USD" }),
    product_reach_count: 20,
    watch_pv: 100,
    click_through_rate: 0.12,
    accumulated_new_follower_count: null,
    buyer_count: 3,
    accumulated_comment_count: 9,
    product_view_count: 30,
    click_order_rate: null,
    avg_watching_duration: 42.5,
    accumulated_sharing_count: 2,
    peak_concurrent_user_count: 11
  }),
  liveViewTrendResponse: Object.freeze({
    view_trend_performances: Object.freeze([Object.freeze({
      stats_type: "SYNTHETIC_VIEW_COUNT",
      data_points: Object.freeze([
        Object.freeze({ value: 10, timestamp: 1706810400 }),
        Object.freeze({ value: null, timestamp: 1706810460 })
      ])
    })])
  })
});
