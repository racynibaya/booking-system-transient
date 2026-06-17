import { Check, Plus } from "lucide-react";
import Link from "next/link";

import { PropertyCard } from "@/components/properties/property-card";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { getCurrentTenant, getProperties, requireUser } from "@/lib/supabase/dal";

function ChecklistStep({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-primary text-on-primary" : "border border-border-strong"
        }`}
      >
        {done && <Check className="size-3" />}
      </span>
      <div className="min-w-0">
        <p className={`text-body-md ${done ? "text-muted-soft line-through" : "text-ink"}`}>
          {label}
        </p>
        {hint && !done && <p className="text-body-sm text-muted">{hint}</p>}
      </div>
    </li>
  );
}

export default async function DashboardPage() {
  await requireUser();
  const tenant = await getCurrentTenant();
  const properties = await getProperties();

  const roomCount = properties.reduce((n, p) => n + (p.room_types?.[0]?.count ?? 0), 0);
  const hasProperty = properties.length > 0;
  const hasRoom = roomCount > 0;
  const setupComplete = hasProperty && hasRoom;
  const greeting = tenant?.name ? `Welcome back, ${tenant.name}.` : "Welcome to Tuloy.";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description={greeting}
        action={
          hasProperty ? (
            <Link href="/properties/new" className={buttonClassName({ size: "sm" })}>
              <Plus className="size-4" /> New property
            </Link>
          ) : undefined
        }
      />

      {!setupComplete && (
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-display-sm text-ink">Get set up</h2>
            <p className="mt-1 text-body-sm text-muted">
              A couple of steps and your place is ready to take bookings.
            </p>
          </div>
          <ol className="flex flex-col gap-4">
            <ChecklistStep done={hasProperty} label="Add your first property" />
            <ChecklistStep
              done={hasRoom}
              label="Add a room type"
              hint="Set how many guests, how many units, and the nightly price."
            />
            <ChecklistStep
              done={false}
              label="Your booking page"
              hint="Your shareable link goes live in an upcoming release."
            />
          </ol>
          <Link
            href={hasProperty ? `/properties/${properties[0].id}` : "/properties/new"}
            className={`${buttonClassName()} self-start`}
          >
            {hasProperty ? "Add a room type" : "Add your first property"}
          </Link>
        </Card>
      )}

      {hasProperty && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Properties" value={properties.length} />
            <Stat label="Room types" value={roomCount} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-display-sm text-ink">Your properties</h2>
            <div className="flex flex-col gap-3">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
