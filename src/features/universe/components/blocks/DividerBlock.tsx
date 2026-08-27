import React from 'react';

export const DividerBlock: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
    </div>
  );
};

export default DividerBlock;
