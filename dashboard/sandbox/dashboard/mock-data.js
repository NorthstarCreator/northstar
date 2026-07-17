window.NORTHSTAR_SANDBOX_DATA = {
  accounts: [
    {
      id: "raised-right",
      name: "Raised Right",
      handle: "@raisedright",
      initials: "RR",
      focus: "Product-led commerce",
      followers: 84200,
      followerChange: 318,
      summary: "Raised Right earned $486 yesterday, and garden products are still gaining momentum."
    },
    {
      id: "truth-tuned-tribe",
      name: "Truth Tuned Tribe",
      handle: "@truthtunedtribe",
      initials: "TT",
      focus: "Education and curiosity",
      followers: 61450,
      followerChange: 486,
      summary: "Truth Tuned Tribe is winning with curiosity-led education and one sample needs filming."
    }
  ],
  revenueSources: [
    {
      id: "shop",
      name: "TikTok Shop",
      shortName: "Shop",
      accent: "shop",
      description: "Product commissions from linked creator-commerce videos.",
      metrics: [
        { key: "commission", label: "Commission" },
        { key: "gmv", label: "GMV" },
        { key: "units", label: "Units Sold" },
        { key: "productsEarning", label: "Products Earning" }
      ]
    },
    {
      id: "rewards",
      name: "Creator Rewards",
      shortName: "Rewards",
      accent: "rewards",
      description: "Estimated rewards from qualified videos and audience engagement.",
      metrics: [
        { key: "rewardsEarned", label: "Rewards Earned" },
        { key: "qualifiedViews", label: "Qualified Views" },
        { key: "eligibleVideos", label: "Eligible Videos" },
        { key: "rpm", label: "Avg Reward / 1K Views" }
      ]
    },
    {
      id: "go",
      name: "TikTok GO",
      shortName: "GO",
      accent: "go",
      description: "Place-led mock commissions from travel, local discovery, and destination content.",
      metrics: [
        { key: "commission", label: "Commission Earned" },
        { key: "linkClicks", label: "Link Clicks" },
        { key: "bookings", label: "Purchases / Bookings" },
        { key: "placesEarning", label: "Places Earning" }
      ]
    }
  ],
  products: [
    {
      id: "garden-hoe",
      accountId: "raised-right",
      name: "2-in-1 Garden Hoe and Weed Puller",
      image: "🌿",
      type: "product",
      workflowStep: 4,
      earnings: 1178,
      gmv: 8940,
      units: 86,
      views: 276000,
      dueDate: "",
      updatedAt: "2026-07-15",
      insight: "Evening demos are still converting after the first spike.",
      bestHook: "If you hate pulling weeds, try this first."
    },
    {
      id: "tds-meter",
      accountId: "raised-right",
      name: "Digital Water Quality Tester",
      image: "💧",
      type: "product",
      workflowStep: 4,
      earnings: 426,
      gmv: 3180,
      units: 37,
      views: 84300,
      dueDate: "",
      updatedAt: "2026-07-14",
      insight: "Curiosity hooks create stronger saves than pure demos.",
      bestHook: "I tested my tap water and did not expect this."
    },
    {
      id: "ai-glasses",
      accountId: "truth-tuned-tribe",
      name: "Smart AI Camera Glasses",
      image: "⌐",
      type: "sample",
      workflowStep: 1,
      earnings: 0,
      gmv: 0,
      units: 0,
      views: 0,
      dueDate: "2026-07-21",
      updatedAt: "2026-07-16",
      insight: "Needs a creator-led demonstration angle before the sample deadline.",
      bestHook: "These glasses record what your hands are doing."
    },
    {
      id: "peptide-playbook",
      accountId: "truth-tuned-tribe",
      name: "Complete Peptide Protocols Playbook",
      image: "📘",
      type: "product",
      workflowStep: 4,
      earnings: 392,
      gmv: 3290,
      units: 42,
      views: 143900,
      dueDate: "",
      updatedAt: "2026-07-13",
      insight: "Authority positioning is producing earnings and audience growth.",
      bestHook: "I researched peptide protocols so you do not have to."
    },
    {
      id: "solar-lantern",
      accountId: "raised-right",
      name: "Hanging Solar Lantern",
      image: "🏮",
      type: "sample",
      workflowStep: 2,
      earnings: 124,
      gmv: 940,
      units: 11,
      views: 37600,
      dueDate: "2026-07-20",
      updatedAt: "2026-07-11",
      insight: "Lifestyle visuals are outperforming product-only shots.",
      bestHook: "The porch light that made my yard feel finished."
    },
    {
      id: "hotel-cafe",
      accountId: "truth-tuned-tribe",
      name: "Historic Hotel Cafe Feature",
      image: "☕",
      type: "place",
      workflowStep: 3,
      earnings: 188,
      gmv: 0,
      units: 0,
      views: 93500,
      dueDate: "",
      updatedAt: "2026-07-12",
      insight: "Local curiosity videos are creating strong TikTok GO intent.",
      bestHook: "This hidden cafe is inside an old hotel."
    }
  ],
  videos: [
    { id: "v1", accountId: "raised-right", productId: "garden-hoe", title: "If you hate pulling weeds, try this first", thumbnail: "🌿", date: "2026-07-16", time: "7:42 PM", views: 88200, likes: 2600, comments: 118, shares: 410, earnings: 328, gmv: 2460, units: 24, qualifiedViews: 0, bookings: 0, linkClicks: 0, sourceIds: ["shop"] },
    { id: "v2", accountId: "raised-right", productId: "garden-hoe", title: "Stop bending over to pull weeds", thumbnail: "🌿", date: "2026-07-12", time: "8:13 PM", views: 126000, likes: 4100, comments: 174, shares: 690, earnings: 512, gmv: 3940, units: 41, qualifiedViews: 0, bookings: 0, linkClicks: 0, sourceIds: ["shop"] },
    { id: "v3", accountId: "raised-right", productId: "tds-meter", title: "I tested my tap water and did not expect this", thumbnail: "💧", date: "2026-07-15", time: "7:04 PM", views: 64300, likes: 1900, comments: 81, shares: 310, earnings: 214, gmv: 1640, units: 20, qualifiedViews: 0, bookings: 0, linkClicks: 0, sourceIds: ["shop"] },
    { id: "v4", accountId: "raised-right", productId: "solar-lantern", title: "The porch light that made my yard feel finished", thumbnail: "🏮", date: "2026-07-11", time: "6:38 PM", views: 37600, likes: 850, comments: 22, shares: 74, earnings: 124, gmv: 940, units: 11, qualifiedViews: 0, bookings: 0, linkClicks: 0, sourceIds: ["shop"] },
    { id: "v5", accountId: "truth-tuned-tribe", productId: "peptide-playbook", title: "I researched peptide protocols so you do not have to", thumbnail: "📘", date: "2026-07-13", time: "2:09 PM", views: 143900, likes: 5200, comments: 211, shares: 1280, earnings: 392, gmv: 3290, units: 42, qualifiedViews: 112000, bookings: 0, linkClicks: 0, sourceIds: ["shop", "rewards"] },
    { id: "v6", accountId: "truth-tuned-tribe", productId: "ai-glasses", title: "These glasses record what your hands are doing", thumbnail: "⌐", date: "2026-07-16", time: "9:18 AM", views: 19200, likes: 460, comments: 39, shares: 94, earnings: 42, gmv: 320, units: 3, qualifiedViews: 15200, bookings: 0, linkClicks: 0, sourceIds: ["shop", "rewards"] },
    { id: "v7", accountId: "truth-tuned-tribe", productId: "hotel-cafe", title: "This hidden cafe is inside an old hotel", thumbnail: "☕", date: "2026-07-12", time: "4:45 PM", views: 93500, likes: 3100, comments: 156, shares: 730, earnings: 188, gmv: 0, units: 0, qualifiedViews: 0, bookings: 18, linkClicks: 412, sourceIds: ["go"] },
    { id: "v8", accountId: "truth-tuned-tribe", productId: "peptide-playbook", title: "One peptide mistake I would not repeat", thumbnail: "📘", date: "2026-07-10", time: "11:28 AM", views: 72000, likes: 2100, comments: 92, shares: 420, earnings: 138, gmv: 0, units: 0, qualifiedViews: 66000, bookings: 0, linkClicks: 0, sourceIds: ["rewards"] }
  ],
  audience: [
    {
      accountId: "raised-right",
      range: "month",
      viewers: {
        total: 389000,
        new: 241000,
        returning: 148000,
        gender: { Female: 53, Male: 44, "Unspecified": 3 },
        age: { "18-24": 8, "25-34": 18, "35-44": 24, "45-54": 31, "55+": 19 },
        locations: { "United States": 82, Canada: 6, "United Kingdom": 4, Australia: 3, Other: 5 },
        hourly: [3100, 2200, 1600, 1200, 900, 1100, 1800, 2600, 4300, 6100, 7200, 7900, 8400, 8800, 9200, 10300, 12100, 15800, 19600, 24200, 21800, 17100, 9800, 5200],
        weekdays: { Mon: 38200, Tue: 42100, Wed: 46500, Thu: 69200, Fri: 63600, Sat: 58100, Sun: 71400 },
        trend: [17200, 19800, 18400, 23100, 20600, 21900, 24800, 26100, 25700, 28400, 27900, 30200, 29600, 32600, 34100, 35300]
      },
      followers: {
        total: 84200,
        netNew: 318,
        gained: 354,
        lost: 36,
        gender: { Female: 55, Male: 42, "Unspecified": 3 },
        age: { "18-24": 6, "25-34": 16, "35-44": 26, "45-54": 33, "55+": 19 },
        locations: { "United States": 86, Canada: 5, "United Kingdom": 3, Australia: 2, Other: 4 },
        hourly: [420, 310, 190, 130, 110, 160, 250, 380, 620, 790, 910, 980, 1040, 1110, 1240, 1490, 1780, 2260, 2910, 3380, 3140, 2380, 1410, 760],
        weekdays: { Mon: 920, Tue: 1010, Wed: 1150, Thu: 1520, Fri: 1470, Sat: 1310, Sun: 1660 },
        trend: [83910, 83928, 83945, 83969, 83988, 84005, 84032, 84051, 84070, 84094, 84116, 84142, 84163, 84182, 84203, 84200]
      }
    },
    {
      accountId: "truth-tuned-tribe",
      range: "month",
      viewers: {
        total: 255700,
        new: 174500,
        returning: 81200,
        gender: { Female: 61, Male: 35, "Unspecified": 4 },
        age: { "18-24": 11, "25-34": 23, "35-44": 27, "45-54": 25, "55+": 14 },
        locations: { "United States": 77, Canada: 8, "United Kingdom": 6, Australia: 4, Other: 5 },
        hourly: [1900, 1400, 1000, 800, 700, 900, 1500, 2300, 4200, 7300, 11200, 13400, 12600, 11900, 10500, 9900, 10800, 12100, 13200, 14700, 13600, 9400, 5200, 2800],
        weekdays: { Mon: 31800, Tue: 33700, Wed: 37900, Thu: 49600, Fri: 42100, Sat: 28900, Sun: 31700 },
        trend: [11800, 13600, 14200, 15100, 14900, 15800, 16200, 17100, 16400, 17600, 18300, 19100, 21400, 19800, 22100, 23800]
      },
      followers: {
        total: 61450,
        netNew: 486,
        gained: 532,
        lost: 46,
        gender: { Female: 64, Male: 32, "Unspecified": 4 },
        age: { "18-24": 10, "25-34": 24, "35-44": 29, "45-54": 27, "55+": 10 },
        locations: { "United States": 79, Canada: 7, "United Kingdom": 6, Australia: 3, Other: 5 },
        hourly: [260, 190, 150, 110, 90, 140, 230, 360, 610, 1150, 1680, 1910, 1770, 1620, 1450, 1370, 1510, 1690, 1880, 2110, 1970, 1320, 760, 420],
        weekdays: { Mon: 710, Tue: 830, Wed: 940, Thu: 1310, Fri: 1120, Sat: 790, Sun: 860 },
        trend: [60990, 61012, 61040, 61069, 61102, 61134, 61162, 61193, 61224, 61261, 61298, 61331, 61368, 61402, 61428, 61450]
      }
    }
  ],
  shopOrders: [
    { id: "ord-1001", accountId: "raised-right", productId: "garden-hoe", videoId: "v1", date: "2026-07-16", status: "Estimated", attributionType: "organic_video", price: 24.99, quantity: 5, commissionBase: 124.95, commissionRate: 0.14, estimatedCommission: 17.49, actualCommission: null, settlement: "Estimated settlement in 14 days", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1002", accountId: "raised-right", productId: "garden-hoe", videoId: "v1", date: "2026-07-16", status: "Estimated", attributionType: "shop_ad", price: 24.99, quantity: 9, commissionBase: 224.91, commissionRate: 0.06, estimatedCommission: 13.49, actualCommission: null, settlement: "Seller ad attribution pending", sellerAdAttributed: true, dataSource: "tiktok_shop" },
    { id: "ord-1003", accountId: "raised-right", productId: "garden-hoe", videoId: "v2", date: "2026-07-12", status: "Estimated", attributionType: "organic_video", price: 24.99, quantity: 14, commissionBase: 349.86, commissionRate: 0.14, estimatedCommission: 48.98, actualCommission: null, settlement: "Estimated settlement in 10 days", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1004", accountId: "raised-right", productId: "garden-hoe", videoId: "v2", date: "2026-07-12", status: "Estimated", attributionType: "shop_ad", price: 24.99, quantity: 18, commissionBase: 449.82, commissionRate: 0.06, estimatedCommission: 26.99, actualCommission: null, settlement: "Seller ad attribution pending", sellerAdAttributed: true, dataSource: "tiktok_shop" },
    { id: "ord-1005", accountId: "raised-right", productId: "tds-meter", videoId: "v3", date: "2026-07-15", status: "Estimated", attributionType: "organic_video", price: 18.99, quantity: 12, commissionBase: 227.88, commissionRate: 0.12, estimatedCommission: 27.35, actualCommission: null, settlement: "Estimated settlement in 13 days", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1006", accountId: "raised-right", productId: "solar-lantern", videoId: "v4", date: "2026-07-11", status: "Paid", attributionType: "organic_video", price: 32.0, quantity: 6, commissionBase: 192.0, commissionRate: 0.1, estimatedCommission: 19.2, actualCommission: 19.2, settlement: "Paid", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1007", accountId: "truth-tuned-tribe", productId: "peptide-playbook", videoId: "v5", date: "2026-07-13", status: "Estimated", attributionType: "organic_video", price: 19.99, quantity: 21, commissionBase: 419.79, commissionRate: 0.15, estimatedCommission: 62.97, actualCommission: null, settlement: "Estimated settlement in 11 days", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1008", accountId: "truth-tuned-tribe", productId: "peptide-playbook", videoId: "v5", date: "2026-07-13", status: "Estimated", attributionType: "shop_ad", price: 19.99, quantity: 13, commissionBase: 259.87, commissionRate: 0.07, estimatedCommission: 18.19, actualCommission: null, settlement: "Seller ad attribution pending", sellerAdAttributed: true, dataSource: "tiktok_shop" },
    { id: "ord-1009", accountId: "truth-tuned-tribe", productId: "ai-glasses", videoId: "v6", date: "2026-07-16", status: "Estimated", attributionType: "organic_video", price: 48.0, quantity: 2, commissionBase: 96.0, commissionRate: 0.08, estimatedCommission: 7.68, actualCommission: null, settlement: "Estimated settlement in 14 days", sellerAdAttributed: false, dataSource: "tiktok_shop" },
    { id: "ord-1010", accountId: "truth-tuned-tribe", productId: "ai-glasses", videoId: "v6", date: "2026-07-16", status: "Estimated", attributionType: "shop_ad", price: 48.0, quantity: 1, commissionBase: 48.0, commissionRate: 0.045, estimatedCommission: 2.16, actualCommission: null, settlement: "Seller ad attribution pending", sellerAdAttributed: true, dataSource: "tiktok_shop" }
  ],
  dataHubSources: [
    { name: "Account Profile", status: "Connected", lastUpdated: "2026-07-16 9:00 AM", records: 2, dataSource: "tiktok_profile" },
    { name: "Video Performance", status: "Sandbox Mock", lastUpdated: "2026-07-16 9:05 AM", records: 8, dataSource: "tiktok_analytics" },
    { name: "Viewer Insights", status: "Sandbox Mock", lastUpdated: "2026-07-16 9:08 AM", records: 2, dataSource: "tiktok_analytics" },
    { name: "Follower Insights", status: "Sandbox Mock", lastUpdated: "2026-07-16 9:08 AM", records: 2, dataSource: "tiktok_analytics" },
    { name: "TikTok Shop Orders", status: "Sandbox Mock", lastUpdated: "2026-07-16 9:12 AM", records: 10, dataSource: "tiktok_shop" },
    { name: "Creator Rewards", status: "Awaiting Source", lastUpdated: "Manual mock only", records: 4, dataSource: "manual_import" },
    { name: "TikTok GO", status: "Awaiting Source", lastUpdated: "Manual mock only", records: 1, dataSource: "future_integration" }
  ],
  days: [
    { date: "2026-07-01", raisedRight: { shop: 88, rewards: 0, go: 0, videos: 1, bestVideo: "Garden refresh", bestProduct: "Garden Hoe", time: "7:10 PM", units: 8 }, truthTunedTribe: { shop: 42, rewards: 18, go: 0, videos: 1, bestVideo: "Peptide intro", bestProduct: "Peptide Playbook", time: "2:20 PM", units: 4 } },
    { date: "2026-07-02", raisedRight: { shop: 144, rewards: 0, go: 0, videos: 2, bestVideo: "Water tester demo", bestProduct: "Water Tester", time: "6:58 PM", units: 13 }, truthTunedTribe: { shop: 36, rewards: 24, go: 0, videos: 1, bestVideo: "Hidden setting", bestProduct: "Peptide Playbook", time: "9:30 AM", units: 3 } },
    { date: "2026-07-03", raisedRight: { shop: 96, rewards: 0, go: 0, videos: 1, bestVideo: "Porch lantern setup", bestProduct: "Solar Lantern", time: "6:30 PM", units: 7 }, truthTunedTribe: { shop: 74, rewards: 31, go: 0, videos: 2, bestVideo: "GHK-Cu explainer", bestProduct: "AI Glasses", time: "10:08 AM", units: 6 } },
    { date: "2026-07-04", raisedRight: { shop: 216, rewards: 0, go: 0, videos: 2, bestVideo: "Patriotic garden prep", bestProduct: "Garden Hoe", time: "8:04 PM", units: 18 }, truthTunedTribe: { shop: 68, rewards: 46, go: 22, videos: 2, bestVideo: "Hotel cafe story", bestProduct: "Hotel Cafe", time: "4:40 PM", units: 5 } },
    { date: "2026-07-05", raisedRight: { shop: 166, rewards: 0, go: 0, videos: 1, bestVideo: "Water test follow-up", bestProduct: "Water Tester", time: "7:18 PM", units: 12 }, truthTunedTribe: { shop: 58, rewards: 38, go: 34, videos: 1, bestVideo: "Cafe hidden detail", bestProduct: "Hotel Cafe", time: "5:05 PM", units: 4 } },
    { date: "2026-07-06", raisedRight: { shop: 112, rewards: 0, go: 0, videos: 1, bestVideo: "Solar lantern night", bestProduct: "Solar Lantern", time: "8:26 PM", units: 8 }, truthTunedTribe: { shop: 44, rewards: 29, go: 28, videos: 1, bestVideo: "Peptide mistake", bestProduct: "Peptide Playbook", time: "11:28 AM", units: 4 } },
    { date: "2026-07-07", raisedRight: { shop: 248, rewards: 0, go: 0, videos: 2, bestVideo: "Weed puller proof", bestProduct: "Garden Hoe", time: "8:13 PM", units: 22 }, truthTunedTribe: { shop: 84, rewards: 51, go: 0, videos: 2, bestVideo: "Protocol comparison", bestProduct: "Peptide Playbook", time: "1:45 PM", units: 7 } },
    { date: "2026-07-08", raisedRight: { shop: 188, rewards: 0, go: 0, videos: 1, bestVideo: "Garden quick fix", bestProduct: "Garden Hoe", time: "7:55 PM", units: 16 }, truthTunedTribe: { shop: 62, rewards: 44, go: 35, videos: 1, bestVideo: "Hotel cafe angle", bestProduct: "Hotel Cafe", time: "4:45 PM", units: 5 } },
    { date: "2026-07-09", raisedRight: { shop: 136, rewards: 0, go: 0, videos: 1, bestVideo: "Water tester curiosity", bestProduct: "Water Tester", time: "7:04 PM", units: 11 }, truthTunedTribe: { shop: 48, rewards: 40, go: 26, videos: 1, bestVideo: "AI glasses hands-free", bestProduct: "AI Glasses", time: "9:18 AM", units: 3 } },
    { date: "2026-07-10", raisedRight: { shop: 158, rewards: 0, go: 0, videos: 1, bestVideo: "Porch before after", bestProduct: "Solar Lantern", time: "6:38 PM", units: 13 }, truthTunedTribe: { shop: 92, rewards: 64, go: 18, videos: 2, bestVideo: "One peptide mistake", bestProduct: "Peptide Playbook", time: "11:28 AM", units: 8 } },
    { date: "2026-07-11", raisedRight: { shop: 214, rewards: 0, go: 0, videos: 2, bestVideo: "Lantern full demo", bestProduct: "Solar Lantern", time: "6:38 PM", units: 18 }, truthTunedTribe: { shop: 52, rewards: 42, go: 31, videos: 1, bestVideo: "Local cafe story", bestProduct: "Hotel Cafe", time: "4:45 PM", units: 4 } },
    { date: "2026-07-12", raisedRight: { shop: 512, rewards: 0, go: 0, videos: 2, bestVideo: "Stop bending over", bestProduct: "Garden Hoe", time: "8:13 PM", units: 41 }, truthTunedTribe: { shop: 70, rewards: 58, go: 188, videos: 2, bestVideo: "Hidden cafe", bestProduct: "Hotel Cafe", time: "4:45 PM", units: 5 } },
    { date: "2026-07-13", raisedRight: { shop: 168, rewards: 0, go: 0, videos: 1, bestVideo: "Water update", bestProduct: "Water Tester", time: "7:20 PM", units: 14 }, truthTunedTribe: { shop: 392, rewards: 74, go: 0, videos: 2, bestVideo: "Peptide protocols", bestProduct: "Peptide Playbook", time: "2:09 PM", units: 42 } },
    { date: "2026-07-14", raisedRight: { shop: 246, rewards: 0, go: 0, videos: 2, bestVideo: "Water tester proof", bestProduct: "Water Tester", time: "7:04 PM", units: 20 }, truthTunedTribe: { shop: 64, rewards: 52, go: 24, videos: 1, bestVideo: "Cafe follow-up", bestProduct: "Hotel Cafe", time: "5:12 PM", units: 5 } },
    { date: "2026-07-15", raisedRight: { shop: 328, rewards: 0, go: 0, videos: 1, bestVideo: "Garden momentum", bestProduct: "Garden Hoe", time: "7:42 PM", units: 24 }, truthTunedTribe: { shop: 82, rewards: 57, go: 0, videos: 1, bestVideo: "AI glasses setup", bestProduct: "AI Glasses", time: "9:18 AM", units: 6 } },
    { date: "2026-07-16", raisedRight: { shop: 486, rewards: 0, go: 0, videos: 2, bestVideo: "Garden proof", bestProduct: "Garden Hoe", time: "7:42 PM", units: 28 }, truthTunedTribe: { shop: 118, rewards: 68, go: 0, videos: 2, bestVideo: "AI glasses demo", bestProduct: "AI Glasses", time: "9:18 AM", units: 9 } }
  ],
  opportunities: [
    { id: "opp-garden", accountId: "raised-right", type: "Film", targetType: "product", targetId: "garden-hoe", noticed: "Garden Hoe keeps earning after repeat videos.", why: "Two evening posts produced the strongest shop commission days.", action: "Film one new proof demo at 7-8 PM." },
    { id: "opp-ai", accountId: "truth-tuned-tribe", type: "Sample", targetType: "product", targetId: "ai-glasses", noticed: "Smart AI Glasses has a sample deadline soon.", why: "The product fits curiosity and hands-free education angles.", action: "Open Product Studio and generate a demo script." },
    { id: "opp-cafe", accountId: "truth-tuned-tribe", type: "Review", targetType: "video", targetId: "v7", noticed: "TikTok GO intent came from one hidden cafe story.", why: "The source produced bookings without product sales language.", action: "Test another local discovery video." }
  ]
};
