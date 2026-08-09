import ExtensionConnectClient from './ExtensionConnectClient';

export default async function ExtensionConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <ExtensionConnectClient
      extensionId={typeof params.extension_id === 'string' ? params.extension_id : ''}
      checkout={params.intent === 'checkout'}
    />
  );
}
