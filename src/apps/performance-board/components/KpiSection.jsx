import KpiCard from './KpiCard';

const sectionWidthClass = {
  full: 'w-full',
  twoThird: 'w-full lg:w-[calc(66.666%-5.33px)]',
  half: 'w-full lg:w-[calc(50%-8px)]',
  third: 'w-full md:w-[calc(50%-8px)] lg:w-[calc(33.333%-10.67px)]',
};

const KpiSection = ({ section, allCards = [], systemFields = [], calculations = [], kpiValues = {}, glassClass, theme = 'dark' }) => {
  const cardsById = new Map(allCards.map((card) => [card.id, card]));
  const fieldDefinitions = new Map([...systemFields, ...calculations].map((field) => [field.id, field]));
  const cards = (section?.fields || []).map((id) => cardsById.get(id)).filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section className={sectionWidthClass[section.width] || sectionWidthClass.full} aria-label={section.title || 'KPI'}>
      {section.title && <h2 className={`mb-2 text-sm font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{section.title}</h2>}
      <div className="flex flex-wrap gap-2">
        {cards.map((card) => {
          const isComposite = card.isComposite || card.mainField;
          const field = isComposite ? fieldDefinitions.get(card.mainField) : fieldDefinitions.get(card.id);
          const valueId = isComposite ? card.mainField : card.id;
          const calculation = calculations.find((item) => item.id === valueId);
          const decimals = calculation?.decimals ?? (calculation?.format === 'percent' ? 2 : field?.decimals);
          const unit = card.unit || (calculation?.format === 'percent' ? '%' : '');
          return (
            <div key={card.id} className="w-[calc(50%-4px)] md:w-[calc(33.333%-5.33px)] lg:w-[calc(25%-6px)] xl:w-[calc(16.666%-6.67px)]">
              <KpiCard
                label={card.label || field?.label || card.id}
                value={kpiValues[valueId]}
                unit={unit}
                decimals={decimals}
                color={card.color}
                glassClass={glassClass}
                theme={theme}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default KpiSection;
