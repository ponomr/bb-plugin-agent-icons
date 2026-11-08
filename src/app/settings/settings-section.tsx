import { experimental_useProviders, experimental_useRpcQuery } from "@get-bb/plugin-sdk/app";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { iconsContract } from "../../shared/contract";
import { DEFAULT_LANGUAGE } from "../../shared/i18n";
import { LanguageProvider, strings } from "../strings";
import { errorMessage } from "./model";
import { needsReload, ProviderRow } from "./provider-row";
import { SetsManager } from "./sets-manager";

/** The plugin's settings page: providers with their icons, then the sets. */
export function SettingsSection() {
  const query = experimental_useRpcQuery({ contract: iconsContract, method: "state", input: null });
  const providers = experimental_useProviders();

  if (query.error && !query.data) {
    const s = strings();
    return (
      <div className="flex flex-col items-start gap-2 text-sm" role="alert">
        <p className="text-destructive">{s.loadFailed(errorMessage(query.error, DEFAULT_LANGUAGE))}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {s.retry}
        </Button>
      </div>
    );
  }
  if (!query.data || providers.status === "loading") {
    return <p className="text-sm text-muted-foreground">{strings().loading}</p>;
  }

  const state = query.data;
  const s = strings(state.language);
  const list = providers.status === "ready" ? providers.providers : [];
  const known = new Set(list.map((p) => p.id));
  const absent = Object.keys(state.assignments)
    .filter((id) => !known.has(id))
    .sort();
  const absentTitle = providers.status === "ready" ? s.notInBb : s.assignmentsTitle;
  const reloadPending = Object.keys(state.assignments).some((id) => needsReload(id, state));

  return (
    <LanguageProvider language={state.language}>
    <div className="flex flex-col gap-4">
      {reloadPending ? (
        <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {s.otherDevicesNotice}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{s.providersTitle}</CardTitle>
          <CardDescription>{s.providersDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {providers.status === "error" ? (
            <p className="text-sm text-destructive">{s.providersUnavailable}</p>
          ) : null}
          <ul className="divide-y divide-border">
            {list.map((provider) => (
              <ProviderRow key={provider.id} provider={provider} state={state} />
            ))}
          </ul>
          {absent.length > 0 ? (
            <section aria-label={absentTitle} className="mt-4">
              <h3 className="text-sm font-medium">{absentTitle}</h3>
              <ul className="divide-y divide-border">
                {absent.map((id) => (
                  <ProviderRow key={id} provider={{ id }} state={state} absent />
                ))}
              </ul>
            </section>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{s.setsTitle}</CardTitle>
          <CardDescription>{s.setsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <SetsManager state={state} providers={list} />
        </CardContent>
      </Card>
    </div>
    </LanguageProvider>
  );
}
