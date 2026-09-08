const getArithmeticReferences = (calculation) => {
  if (calculation.type !== 'arithmetic') return [];
  if (calculation.terms?.length > 0) {
    return calculation.terms.map(term => term.field);
  }
  return [calculation.fieldA, calculation.fieldB];
};

export const getCalculationWarnings = ({
  calculations = [],
  systemFields = [],
  indicatorGroups = [],
} = {}) => {
  const warnings = [];
  const calculationsById = new Map(calculations.map(calc => [calc.id, calc]));
  const validFieldIds = new Set([
    ...systemFields.map(field => field.id),
    ...calculationsById.keys(),
    ...indicatorGroups.map(group => group.id),
  ]);

  calculations.forEach(calc => {
    const seenReferences = new Set();
    getArithmeticReferences(calc).forEach(fieldId => {
      if (seenReferences.has(fieldId)) return;
      seenReferences.add(fieldId);
      if (fieldId && validFieldIds.has(fieldId)) return;

      const fieldLabel = fieldId || '（未選択）';
      warnings.push({
        type: 'calculation-undefined',
        calculationId: calc.id,
        fieldId: fieldId || '',
        message: `計算指標「${calc.label || calc.id}」が未定義のフィールド「${fieldLabel}」を参照しています。計算式を修正してください。`,
      });
    });
  });

  const dependencyGraph = new Map(
    calculations.map(calc => [
      calc.id,
      getArithmeticReferences(calc).filter(fieldId => calculationsById.has(fieldId)),
    ])
  );
  const visitState = new Map();
  const path = [];
  const reportedCycles = new Set();

  const visit = (calculationId) => {
    visitState.set(calculationId, 1);
    path.push(calculationId);

    for (const dependencyId of dependencyGraph.get(calculationId) || []) {
      const state = visitState.get(dependencyId) || 0;
      if (state === 0) {
        visit(dependencyId);
      } else if (state === 1) {
        const cycleStart = path.indexOf(dependencyId);
        const cycleIds = [...path.slice(cycleStart), dependencyId];
        const cycleKey = [...new Set(cycleIds.slice(0, -1))].sort().join('|');
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          const cycleLabels = cycleIds.map(id => calculationsById.get(id)?.label || id);
          warnings.push({
            type: 'calculation-cycle',
            calculationIds: cycleIds.slice(0, -1),
            message: `計算指標が循環参照しています（${cycleLabels.join(' → ')}）。計算式の参照順を修正してください。`,
          });
        }
      }
    }

    path.pop();
    visitState.set(calculationId, 2);
  };

  calculations.forEach(calc => {
    if ((visitState.get(calc.id) || 0) === 0) visit(calc.id);
  });

  return warnings;
};
