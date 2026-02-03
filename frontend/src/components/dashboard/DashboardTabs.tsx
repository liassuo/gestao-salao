import { LayoutDashboard, TrendingUp } from 'lucide-react';

interface DashboardTabsProps {
  activeTab: 'operational' | 'strategic';
  onTabChange: (tab: 'operational' | 'strategic') => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  const tabs = [
    { key: 'operational' as const, label: 'Operacional', icon: LayoutDashboard },
    { key: 'strategic' as const, label: 'Estratégica', icon: TrendingUp },
  ];

  return (
    <div className="flex gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.key
              ? 'bg-blue-600 text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
