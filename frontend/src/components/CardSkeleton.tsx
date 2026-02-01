import { InfoCard } from './InfoCard';
import { Skeleton } from './Skeleton';

export function CardSkeleton({
  title,
  rows = 5,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <InfoCard title={title}>
      <div className="space-y-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />

        <div className="mt-4 space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    </InfoCard>
  );
}
