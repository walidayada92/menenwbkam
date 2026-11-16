import React from "react";
import { cn } from "../utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export const Card = ({
  className,
  title,
  subtitle,
  children,
  ...props
}: CardProps) => {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden",
        className,
      )}
      {...props}
    >
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};
