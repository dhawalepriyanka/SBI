const accountColumns = [36.01, 138.65, 241.03, 358.04, 460.42, 575.48];
const accountRows = [603.76, 616.43, 630.43, 644.43];

const loanColumns = [36.01, 133.16, 184.06, 265.96, 391.16, 518.99, 575.48];
const loanRows = [660.13, 672.8, 686.81, 700.81, 714.81, 728.81, 742.82, 756.82, 770.82, 784.83, 798.83];

const propertyColumns = [36.43, 112.36, 270.14, 332.28, 416.81, 573.97];
const assetColumns = [36.43, 169.12, 281.16, 375.36, 467.78, 573.97];
const assetRows = [296.3, 313.06, 331.51, 349.56, 367.6, 385.64, 403.68, 421.73, 450.76, 478.22];

function createTableFields(page, name, columns, rows) {
  const fields = [];
  // The first interval contains the printed column headings.
  for (let row = 1; row < rows.length - 1; row += 1) {
    for (let column = 0; column < columns.length - 1; column += 1) {
      const x = columns[column];
      const y = rows[row];
      const width = columns[column + 1] - x;
      const height = rows[row + 1] - y;
      fields.push({
        id: `p${page}_${name}_r${row}_c${column + 1}`,
        type: 'text',
        x: x + 0.8,
        y: y + 0.8,
        width: width - 1.6,
        height: height - 1.6,
        maxLength: Math.max(6, Math.floor(width / 5)),
      });
    }
  }
  return fields;
}

function createPersonalAssetsFields(page) {
  const fields = propertyColumns.slice(0, -1).map((x, column) => ({
    id: `p${page}_property_c${column + 1}`,
    type: 'multiline',
    x: x + 1,
    y: 177.22,
    width: propertyColumns[column + 1] - x - 2,
    height: 81.11,
  }));

  // Printed descriptions occupy columns 1 and 3. Columns 2, 4 and 5
  // are the editable amount/outstanding/EMI cells.
  for (let row = 1; row < assetRows.length - 1; row += 1) {
    [1, 3, 4].forEach((column) => {
      const x = assetColumns[column];
      const width = assetColumns[column + 1] - x;
      fields.push({
        id: `p${page}_assets_r${row}_c${column + 1}`,
        type: 'text',
        x: x + 0.8,
        y: assetRows[row] + 0.8,
        width: width - 1.6,
        height: assetRows[row + 1] - assetRows[row] - 1.6,
        maxLength: Math.max(8, Math.floor(width / 5)),
      });
    });
  }
  return fields;
}

function createOpinionReportFields(page) {
  const fields = [
    { id: `p${page}_borrower_name`, x: 165, y: 522, width: 185, height: 17, maxLength: 32 },
    { id: `p${page}_report_name`, x: 37.2, y: 575.5, width: 202.1, height: 11.5, maxLength: 28 },
    { id: `p${page}_report_age`, x: 310, y: 575.5, width: 27, height: 11.5, maxLength: 3 },
    { id: `p${page}_report_resident`, x: 442.9, y: 575.5, width: 68.4, height: 11.5, maxLength: 8 },
    { id: `p${page}_report_loan`, x: 211.5, y: 590.75, width: 104.4, height: 11.5, maxLength: 16 },
    { id: `p${page}_report_amount`, x: 414.4, y: 590.75, width: 53.3, height: 11.5, maxLength: 9 },
    { id: `p${page}_report_net_worth`, x: 91.3, y: 606, width: 82.6, height: 11.5, maxLength: 12 },
    { id: `p${page}_report_guarantor`, x: 215.2, y: 621.25, width: 136.7, height: 11.5, maxLength: 20 },
    { id: `p${page}_manager_place`, x: 70, y: 756, width: 150, height: 13, maxLength: 24 },
    { id: `p${page}_manager_date`, x: 70, y: 771, width: 100, height: 13, maxLength: 12 },
  ].map((field) => ({ ...field, type: 'text' }));

  const tableRows = [633.66, 648.62, 663.89, 679.15, 694.42, 708.57];
  for (let row = 0; row < tableRows.length - 1; row += 1) {
    const y = tableRows[row] + 0.8;
    const height = tableRows[row + 1] - tableRows[row] - 1.6;
    fields.push({
      id: `p${page}_opinion_r${row + 1}_amount`,
      type: 'text',
      x: 282.0,
      y,
      width: 290.0,
      height,
      maxLength: 36,
    });
  }
  return fields;
}

export function addClickableTables(fieldMap) {
  const pages = { ...fieldMap.pages };
  [5, 9].forEach((page) => {
    pages[String(page)] = [
      ...(pages[String(page)] || []),
      ...createTableFields(page, 'account', accountColumns, accountRows),
      ...createTableFields(page, 'loan', loanColumns, loanRows),
    ];
  });
  [6, 10].forEach((page) => {
    const inaccurateIds = new Set(Array.from({ length: 9 }, (_, index) => `p${page}_${String(index + 1).padStart(3, '0')}`));
    pages[String(page)] = [
      ...(pages[String(page)] || []).filter((field) => !inaccurateIds.has(field.id)),
      ...createPersonalAssetsFields(page),
      ...createOpinionReportFields(page),
    ];
  });
  [4, 8].forEach((page) => {
    pages[String(page)] = (pages[String(page)] || []).map((field) => {
      if (field.id === `p${page}_024`) {
        return { ...field, y: 298.2, height: 11.5 };
      }
      return field;
    });
  });
  pages['14'] = [
    ...(pages['14'] || []),
    { id: 'p14_acceptance_place', type: 'text', x: 75, y: 466, width: 145, height: 12, maxLength: 24 },
    { id: 'p14_acceptance_date', type: 'text', x: 75, y: 479, width: 100, height: 12, maxLength: 12 },
    { id: 'p14_acknowledgment_date_place', type: 'text', x: 92.5, y: 782.2, width: 88, height: 12, maxLength: 32 },
  ];
  pages['15'] = [
    ...(pages['15'] || []).filter((field) => field.id !== 'p15_001' && field.id !== 'p15_002'),
    { id: 'p15_loan_product_name', type: 'text', x: 55.5, y: 88.5, width: 287.8, height: 12, maxLength: 42 },
    { id: 'p15_loan_amount', type: 'text', x: 326, y: 109.6, width: 215.8, height: 14.8, maxLength: 22 },
    { id: 'p15_loan_term_years', type: 'text', x: 307, y: 126.2, width: 46, height: 12.8, maxLength: 3, align: 'center' },
    { id: 'p15_loan_term_months', type: 'text', x: 363, y: 126.2, width: 48, height: 12.8, maxLength: 3, align: 'center' },
    { id: 'p15_interest_type', type: 'select', x: 295.5, y: 140.8, width: 246.5, height: 29.2, options: ['Fixed', 'Floating'] },
    { id: 'p15_floating_interest_rate', type: 'text', x: 314, y: 170.5, width: 22, height: 14, maxLength: 5, align: 'center' },
    { id: 'p15_base_rate_spread', type: 'text', x: 418, y: 170.5, width: 25, height: 14, maxLength: 5, align: 'left' },
    { id: 'p15_processing_fee', type: 'text', x: 422, y: 293.2, width: 118.8, height: 12.2, maxLength: 18 },
    { id: 'p15_legal_opinion_fee', type: 'text', x: 452, y: 307.8, width: 88.8, height: 12.2, maxLength: 18 },
    { id: 'p15_valuation_fee', type: 'text', x: 420, y: 322.4, width: 120.8, height: 12.2, maxLength: 18 },
    { id: 'p15_cersai_fee', type: 'text', x: 459, y: 337, width: 81.8, height: 12.2, maxLength: 18 },
    { id: 'p15_emi_amount', type: 'text', x: 326, y: 595, width: 214.8, height: 13, maxLength: 22 },
    { id: 'p15_security_1', type: 'text', x: 326, y: 646, width: 214.8, height: 12.5, maxLength: 34 },
    { id: 'p15_security_2', type: 'text', x: 326, y: 661, width: 214.8, height: 12.5, maxLength: 34 },
    { id: 'p15_security_3', type: 'text', x: 326, y: 676, width: 214.8, height: 12.5, maxLength: 34 },
  ];
  const interactionRows = [274.04, 286.62, 299.68, 324.5, 361.46, 386.01, 398.7, 435.65, 460.47, 484.97, 497.7, 510.16, 535.35, 571.86];
  const interactionChoiceFields = interactionRows.slice(0, -1).flatMap((top, index) => {
    const rowHeight = interactionRows[index + 1] - top;
    const y = top + Math.max(1, (rowHeight - 10) / 2);
    return [
      { id: `p16_row${index + 7}_yes`, type: 'checkbox', x: 432, y, width: 10, height: 10 },
      { id: `p16_row${index + 7}_no`, type: 'checkbox', x: 510, y, width: 10, height: 10 },
    ];
  });
  pages['16'] = [
    ...(pages['16'] || []),
    { id: 'p16_applicant_name', type: 'text', x: 403.5, y: 100.9, width: 134.6, height: 11.4, maxLength: 32 },
    { id: 'p16_mobile_email', type: 'text', x: 403.5, y: 113.9, width: 134.6, height: 23.4, maxLength: 48 },
    { id: 'p16_loan_amount', type: 'text', x: 403.5, y: 138.9, width: 134.6, height: 23.2, maxLength: 20 },
    { id: 'p16_sourcing_entity_code', type: 'text', x: 371.2, y: 163.7, width: 30.7, height: 35.4, maxLength: 6 },
    { id: 'p16_sourcing_official_name', type: 'text', x: 403.5, y: 200.7, width: 134.6, height: 23.2, maxLength: 32 },
    { id: 'p16_sourcing_mobile', type: 'text', x: 450, y: 225.5, width: 87.9, height: 22.9, maxLength: 16 },
    { id: 'p16_sourcing_code', type: 'text', x: 450, y: 250, width: 87.9, height: 23.2, maxLength: 16 },
    ...interactionChoiceFields,
    { id: 'p16_interaction_date', type: 'text', x: 170, y: 594, width: 100, height: 12, maxLength: 14 },
    { id: 'p16_interaction_place', type: 'text', x: 91, y: 609, width: 157, height: 12, maxLength: 28 },
  ];
  pages['18'] = [
    ...(pages['18'] || []).filter((field) => field.id !== 'p18_001'),
    { id: 'p18_stamp_duty_amount', type: 'text', x: 426.1, y: 704.8, width: 135.6, height: 24, maxLength: 18 },
    { id: 'p18_registration_amount', type: 'text', x: 426.1, y: 730.4, width: 135.6, height: 10.9, maxLength: 18 },
    { id: 'p18_other_fee_reason', type: 'text', x: 48.9, y: 742.9, width: 151.1, height: 23.3, maxLength: 28 },
    { id: 'p18_other_fee_particular', type: 'text', x: 253, y: 742.9, width: 101.2, height: 12, maxLength: 22 },
    { id: 'p18_other_fee_amount', type: 'text', x: 426.1, y: 742.9, width: 135.6, height: 23.3, maxLength: 18 },
    { id: 'p18_total_fee_amount', type: 'text', x: 426.1, y: 767.8, width: 135.6, height: 10.8, maxLength: 18 },
  ];
  const sellerColumns = [36, 167, 298, 391, 483, 576];
  const propertyDetailFields = [
    // These rows contain 21 printed character boxes.  A 22-character grid
    // causes each overlay cell to drift off its corresponding printed box.
    { id: 'p11_rera_registration', type: 'character', x: 146.5, y: 322.5, width: 252, height: 11.4, maxLength: 21 },
    { id: 'p11_project_name', type: 'character', x: 146.5, y: 337.6, width: 252, height: 11.4, maxLength: 21 },
    { id: 'p11_property_value', type: 'character', x: 117.9, y: 472.4, width: 143.3, height: 11.5, maxLength: 12 },
    { id: 'p11_property_owner_name', type: 'character', x: 167.5, y: 487.5, width: 276, height: 11.5, maxLength: 23 },
    { id: 'p11_building_name', type: 'character', x: 118.1, y: 577.1, width: 181.4, height: 11.5, maxLength: 15 },
    { id: 'p11_wing_name', type: 'character', x: 118.1, y: 592.2, width: 181.4, height: 11.5, maxLength: 15 },
    { id: 'p11_property_address_1', type: 'character', x: 73.4, y: 652.6, width: 492.5, height: 11.5, maxLength: 41 },
    { id: 'p11_property_address_2', type: 'character', x: 73.4, y: 667.7, width: 492.5, height: 11.5, maxLength: 41 },
    { id: 'p11_property_address_3', type: 'character', x: 73.4, y: 682.8, width: 492.5, height: 11.5, maxLength: 41 },
    // City and State each have 20 pre-printed boxes.  Their original
    // coordinates started inside the first box, which made the character
    // overlay drift across the grid at browser zoom levels.
    { id: 'p11_property_city', type: 'character', x: 213.4, y: 697.3, width: 239.6, height: 11.5, maxLength: 20 },
    { id: 'p11_property_district', type: 'character', x: 73.4, y: 712.4, width: 105.1, height: 11.5, maxLength: 9 },
    { id: 'p11_property_state', type: 'character', x: 213.4, y: 712.4, width: 239.6, height: 11.5, maxLength: 20 },
  ];
  pages['11'] = [
    ...(pages['11'] || [])
      .filter((field) => field.id !== 'p11_018')
      .map((field) => ['p11_013', 'p11_014', 'p11_017', 'p11_035', 'p11_036', 'p11_038', 'p11_041', 'p11_043'].includes(field.id)
        ? { ...field, type: 'character', maxLength: 2 }
        : field.id === 'p11_039'
          ? { ...field, maxLength: 7 }
        : field),
    { id: 'p11_purpose_purchase_plot', type: 'checkbox', x: 68.4, y: 41.02, width: 12.96, height: 10.07 },
    { id: 'p11_requested_loan_form_c', type: 'character', x: 125.5, y: 85.8, width: 120, height: 11, maxLength: 10 },
    ...sellerColumns.slice(0, -1).map((x, column) => ({
      id: `p11_seller_c${column + 1}`,
      type: 'text',
      x: x + 0.8,
      y: 280.71,
      width: sellerColumns[column + 1] - x - 1.6,
      height: 12.79,
      maxLength: [24, 22, 18, 18, 15][column],
    })),
    ...propertyDetailFields,
  ];
  const constructionDetailIds = new Set(Array.from({ length: 14 }, (_, index) => `p12_${String(index + 1).padStart(3, '0')}`));
  const obsoleteCollateralIds = new Set(['p12_026', 'p12_027', 'p12_028', 'p12_029']);
  const collateralColumns = [44.64, 149.04, 253.44, 359.28, 463.68, 567.36];
  const collateralRows = [418.79, 433.18, 446.85, 461.24, 475.63];
  const collateralFields = collateralRows.slice(0, -1).flatMap((top, row) => collateralColumns.slice(0, -1).map((left, column) => ({
    id: `p12_collateral_r${row + 1}_c${column + 1}`,
    type: 'text',
    x: left + 0.8,
    y: top + 0.8,
    width: collateralColumns[column + 1] - left - 1.6,
    height: collateralRows[row + 1] - top - 1.6,
    maxLength: Math.max(12, Math.floor((collateralColumns[column + 1] - left) / 4.8)),
  })));
  pages['12'] = [
    ...(pages['12'] || []).filter((field) => !obsoleteCollateralIds.has(field.id)).map((field) => constructionDetailIds.has(field.id)
      ? { ...field, maxLength: 9 }
      : field),
    ...collateralFields,
  ];
  [21, 23].forEach((page) => {
    pages[String(page)] = [
      ...(pages[String(page)] || []).map((field) => {
        if ([`p${page}_002`].includes(field.id)) return { ...field, maxLength: 18 };
        if ([`p${page}_004`, `p${page}_007`].includes(field.id)) return { ...field, maxLength: 16 };
        return field;
      }),
      { id: `p${page}_name`, type: 'character', x: 131, y: 268.4, width: 447.2, height: 12.95, maxLength: 35 },
      { id: `p${page}_maiden_name`, type: 'character', x: 131, y: 297.9, width: 447.2, height: 12.23, maxLength: 35 },
      { id: `p${page}_occupation_other_specify`, type: 'text', x: 350, y: 485.71, width: 93, height: 12.95, maxLength: 24 },
      { id: `p${page}_religion_other`, type: 'text', x: 335, y: 522.4, width: 85, height: 12.95, maxLength: 22 },
      { id: `p${page}_organization_name`, type: 'text', x: 102, y: 595.8, width: 95, height: 12.95, maxLength: 28 },
      { id: `p${page}_citizenship`, type: 'text', x: 346, y: 651.21, width: 98, height: 12.95, maxLength: 28 },
    ];
  });
  [22, 24].forEach((page) => {
    pages[String(page)] = [
      ...(pages[String(page)] || []).filter((field) => field.id !== `p${page}_050`).map((field) => {
        if ([`p${page}_046`, `p${page}_048`, `p${page}_049`].includes(field.id)) return { ...field, type: 'text' };
        return field;
      }),
      { id: `p${page}_address_scope_current`, type: 'checkbox', x: 99, y: 190.5, width: 10.5, height: 10.5 },
      { id: `p${page}_address_scope_permanent`, type: 'checkbox', x: 146.5, y: 190.5, width: 10.5, height: 10.5 },
      { id: `p${page}_address_scope_overseas`, type: 'checkbox', x: 205, y: 190.5, width: 10.5, height: 10.5 },
      { id: `p${page}_address_line_1`, type: 'character', x: 67.5, y: 230, width: 510.5, height: 13, maxLength: 41 },
      { id: `p${page}_address_line_2`, type: 'character', x: 67.5, y: 249, width: 510.5, height: 13, maxLength: 41 },
      { id: `p${page}_correspondence_scope`, type: 'checkbox', x: 98, y: 307.5, width: 10.5, height: 10.5 },
      { id: `p${page}_local_scope`, type: 'checkbox', x: 179.5, y: 307.5, width: 10.5, height: 10.5 },
      { id: `p${page}_same_address_scope`, type: 'checkbox', x: 219.5, y: 307.5, width: 10.5, height: 10.5 },
      { id: `p${page}_correspondence_address_1`, type: 'character', x: 67.5, y: 347, width: 510.5, height: 13, maxLength: 41 },
      { id: `p${page}_correspondence_address_2`, type: 'character', x: 67.5, y: 366, width: 510.5, height: 13, maxLength: 41 },
      { id: `p${page}_declaration_place`, type: 'character', x: 54.5, y: 667, width: 268.5, height: 13, maxLength: 21 },
      { id: `p${page}_declaration_date`, type: 'character', x: 371, y: 667, width: 103, height: 13, maxLength: 8 },
      { id: `p${page}_office_documents_received`, type: 'checkbox', x: 162.5, y: 693.5, width: 10.5, height: 10.5 },
      { id: `p${page}_office_self_certified`, type: 'checkbox', x: 255, y: 693.5, width: 10.5, height: 10.5 },
      { id: `p${page}_office_true_copies`, type: 'checkbox', x: 322.5, y: 693.5, width: 10.5, height: 10.5 },
      { id: `p${page}_office_notary`, type: 'checkbox', x: 386.5, y: 693.5, width: 10.5, height: 10.5 },
    ];
  });
  pages['20'] = [
    { id: 'p20_001', type: 'multiline', x: 42, y: 86, width: 528, height: 705 },
  ];
  ['23', '24'].forEach((page) => {
    pages[page] = (pages[page] || []).map((field) => {
      if (field.type === 'text') {
        return { ...field, maxLength: Math.max(field.maxLength || 35, 45) };
      }
      return field;
    });
  });
  return { ...fieldMap, pages };
}
