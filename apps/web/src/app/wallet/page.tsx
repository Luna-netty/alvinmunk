'use client';

import { useState } from 'react';
import { type Wallet } from '@/lib/wallet';
import { connectViaKit } from '@/lib/wallet-kit';
import { getXlmBalance, txExplorerUrl } from '@/lib/stellar';
import { sendXlm, type PaymentResult } from '@/lib/payments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HandleTransfer } from '@/components/HandleTransfer';
import { isStellarAddress, shortAddr } from '@alvinmunk/shared';

/**
 * Connect a Stellar wallet, show the balance, and send a testnet XLM payment with
 * pending/success/failure + tx-hash feedback. Also where a user outgrowing the in-app
 * key moves its @handle to the connected wallet.
 */
export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1');
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addrTouched, setAddrTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const validAddr = isStellarAddress(to.trim(), { allowContract: false });
  const validAmount = Number(amount) > 0;

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const w = await connectViaKit();
      setWallet(w);
      setBalance(await getXlmBalance(w.address).catch(() => '0'));
    } catch (e) {
      setError(msg(e));
    } finally {
      setConnecting(false);
    }
  }

  async function refresh() {
    if (wallet) setBalance(await getXlmBalance(wallet.address));
  }

  async function pay() {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await sendXlm(wallet, to.trim(), amount);
      setResult(r);
      await refresh();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-md py-12">
      <h1 className="mb-1 text-2xl font-semibold">Wallet</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Connect a wallet, check your balance, and send a testnet XLM payment.
      </p>

      {!wallet ? (
        <Button size="lg" onClick={connect} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect a wallet'}
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs text-muted-foreground">Connected</p>
                <p className="font-mono text-sm">{shortAddr(wallet.address)}</p>
                <p className="mt-2 text-sm">
                  Balance:{' '}
                  <span className="font-semibold text-primary">
                    {balance ? `${Number(balance).toFixed(2)} XLM` : '…'}
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWallet(null)}>
                Disconnect
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <h2 className="text-sm font-semibold">Send XLM (testnet)</h2>
              <Input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onBlur={() => setAddrTouched(true)}
                placeholder="destination address (G…)"
                className="font-mono text-xs"
              />
              {addrTouched && !validAddr && (
                <p className="text-xs text-destructive">Enter a G… address</p>
              )}
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setAmountTouched(true)}
                inputMode="decimal"
                placeholder="amount"
              />
              {amountTouched && !validAmount && (
                <p className="text-xs text-destructive">Amount must be greater than 0</p>
              )}
              <Button onClick={pay} disabled={busy || !validAddr || !validAmount}>
                {busy ? 'Sending…' : 'Send'}
              </Button>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              {result && (
                <div
                  className={
                    result.status === 'SUCCESS'
                      ? 'rounded-xl bg-success/10 p-3 text-xs text-success ring-1 ring-success/30'
                      : result.status === 'FAILED'
                        ? 'rounded-xl bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/30'
                        : 'rounded-xl bg-muted p-3 text-xs text-muted-foreground'
                  }
                >
                  <p className="font-semibold">
                    {result.status === 'SUCCESS'
                      ? '✓ Payment confirmed'
                      : result.status === 'FAILED'
                        ? '✗ Payment failed'
                        : '… Submitted (pending)'}
                  </p>
                  <a
                    href={txExplorerUrl(result.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline"
                  >
                    {result.hash}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <HandleTransfer wallet={wallet} />
        </div>
      )}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
