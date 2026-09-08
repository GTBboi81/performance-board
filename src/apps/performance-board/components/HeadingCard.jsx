import { Bookmark, CornerDownRight, Hash, Star, Tag, Target, TrendingUp, Zap } from 'lucide-react';
import { widthClass } from './layoutItems';

const icons = { default: CornerDownRight, tag: Tag, bookmark: Bookmark, hash: Hash, star: Star, zap: Zap, target: Target, trending: TrendingUp };

const HeadingCard = ({ text, subText, icon = 'default', align = 'left', width, theme = 'dark' }) => {
  const Icon = icons[icon] || icons.default;
  const alignment = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[align] || 'justify-start';
  return (
    <section className={`${widthClass(width)} flex items-center gap-2 mb-1 ml-1 ${alignment}`}>
      <Icon size={16} className="text-sky-500 shrink-0" />
      <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{text}</h2>
      {subText && <span className={`text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{subText}</span>}
    </section>
  );
};

export default HeadingCard;
