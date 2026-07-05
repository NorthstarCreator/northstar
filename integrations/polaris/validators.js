(function () {
  function validateNumbers(record, fields, issues) {
    fields.forEach((field) => {
      const value = Number(record[field] || 0);
      if (Number.isNaN(value)) issues.push({ type: "Invalid number", recordType: record.type, id: record.id, field, message: `${field} is not a valid number.` });
      if (value < 0) issues.push({ type: "Negative value", recordType: record.type, id: record.id, field, message: `${field} is below zero.` });
    });
  }

  function duplicateIssues(records, keyFn, label) {
    const seen = new Map();
    const issues = [];
    records.forEach((record) => {
      const key = keyFn(record);
      if (!key) return;
      if (seen.has(key)) issues.push({ type: "Duplicate", recordType: label, id: record.id, message: `${label} may duplicate ${seen.get(key)}.` });
      seen.set(key, record.id);
    });
    return issues;
  }

  function validateNormalized(batch) {
    const warnings = [];
    const errors = [];

    batch.products.forEach((product) => {
      if (!product.name || product.name === "Untitled product") warnings.push({ type: "Missing product name", recordType: "Product", id: product.id, message: "Product name is missing." });
      if (!product.category || product.category === "Uncategorized") warnings.push({ type: "Empty category", recordType: "Product", id: product.id, message: `${product.name} has no category yet.` });
      if (product.commission > product.gmv && product.gmv > 0) warnings.push({ type: "Suspicious commission", recordType: "Product", id: product.id, message: `${product.name} has commission higher than GMV.` });
      if (product.gmv === 0 && product.unitsSold > 0) warnings.push({ type: "Missing GMV", recordType: "Product", id: product.id, message: `${product.name} has units but no GMV.` });
      validateNumbers(product, ["gmv", "commission", "unitsSold"], errors);
    });

    batch.videos.forEach((video) => {
      if (!video.hook || video.hook === "Untitled hook") warnings.push({ type: "Missing hook", recordType: "Video", id: video.id, message: "Video hook is missing." });
      if (video.views > 1000000 && video.likes < 10) warnings.push({ type: "Suspicious engagement", recordType: "Video", id: video.id, message: `${video.hook} has unusually high views with low engagement.` });
      validateNumbers(video, ["views", "likes", "comments", "shares", "saves", "sales", "gmv", "commission", "newFollowers"], errors);
    });

    warnings.push(...duplicateIssues(batch.products, (record) => `${record.accountId}|${record.name}`.toLowerCase(), "Product"));
    warnings.push(...duplicateIssues(batch.videos, (record) => `${record.accountId}|${record.datePosted}|${record.hook}`.toLowerCase(), "Video"));

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      summary: {
        warnings: warnings.length,
        errors: errors.length,
        recordsChecked: batch.products.length + batch.videos.length + batch.salesRecords.length + batch.sampleRecords.length + batch.lessons.length + batch.importBatches.length
      }
    };
  }

  window.NorthstarPolaris = window.NorthstarPolaris || {};
  window.NorthstarPolaris.validators = { validateNormalized };
})();
