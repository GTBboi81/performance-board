import { LAYOUT_ITEM_LABELS, LAYOUT_ITEM_TYPES } from '../layoutItems';

const LayoutAddPanel = ({ availableItems, onAdd, textClass, textMutedClass, theme }) => (
  <section className={`rounded-xl p-4 border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
    <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>要素を追加</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {LAYOUT_ITEM_TYPES.filter((type) => type !== 'row').map((type) => {
        const items = availableItems.filter((item) => item.type === type);
        return <div key={type} className="space-y-1">
          <p className={`text-xs font-medium ${textMutedClass}`}>{LAYOUT_ITEM_LABELS[type]}</p>
          {items.map((item) => <button key={item.refId} type="button" onClick={() => onAdd(item)} className={`w-full text-left rounded px-2 py-1.5 text-xs ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-white hover:bg-gray-100 text-gray-700'}`}>+ {item.label}</button>)}
          {items.length === 0 && <p className={`text-xs ${textMutedClass}`}>追加できる項目はありません</p>}
        </div>;
      })}
    </div>
  </section>
);

export default LayoutAddPanel;
