import { useState } from 'react';
import { Tag } from 'lucide-react';
import VersionHistoryModal from './VersionHistoryModal';
import versionData from '../version.json';

const VersionBadge = ({ theme }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="バージョン履歴を見る"
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-all ${
          theme === 'dark'
            ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-200'
        }`}
      >
        <Tag size={12} />
        <span className="font-mono">v{versionData.current}</span>
      </button>
      {open && (
        <VersionHistoryModal
          theme={theme}
          data={versionData}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default VersionBadge;
