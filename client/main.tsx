import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Download,
  FlaskConical,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { actions, scenarioSchema, type Scenario, type Step, type Run } from '../shared/schema';
import { formatRunTimestamp } from './format-run-timestamp';
import './style.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
const labels: Record<string, string> = {
  open: 'Open Page',
  click: 'Click Element',
  fill: 'Fill Field',
  offline: 'Go Offline',
  online: 'Go Online',
  fail: 'Fail API Request',
  delay: 'Delay API Response',
  check: 'Check Element',
  value: 'Check Field Value',
  screenshot: 'Take Screenshot',
};
async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-LinkSunder': 'local' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Request failed');
  return data;
}
const initial = () =>
  scenarioSchema.parse({
    name: 'Untitled resilience test',
    url: window.location.origin + '/demo/fixed',
  });
function App() {
  const [view, setView] = useState('dashboard');
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run>();
  const [scenario, setScenario] = useState<Scenario>(initial);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [timeout, setTimeoutValue] = useState(Number(localStorage.getItem('timeout') || 10000));
  const [json, setJson] = useState('');
  const [nextDemo, setNextDemo] = useState<Scenario>();
  const [savedScenarios, setSavedScenarios] = useState<Scenario[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('scenarios') || '[]');
      return Array.isArray(saved)
        ? saved
            .filter((s) => scenarioSchema.safeParse(s).success)
            .map((s) => scenarioSchema.parse(s))
        : [];
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState('');
  const [reportDirectory, setReportDirectory] = useState('Local report storage');
  useEffect(() => {
    api<{ reportDirectory: string }>('/api/info')
      .then((info) => setReportDirectory(info.reportDirectory))
      .catch(() => {});
  }, []);
  function saveScenario() {
    const result = scenarioSchema.safeParse(scenario);
    if (!result.success) {
      setError('Enter a scenario name, valid URL and valid settings before saving.');
      return;
    }
    const next = [...savedScenarios.filter((s) => s.name !== result.data.name), result.data];
    localStorage.setItem('scenarios', JSON.stringify(next));
    setSavedScenarios(next);
    setNotice('Scenario saved on this computer.');
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      api<Run[]>('/api/runs')
        .then((x) => {
          if (live) setRuns(x);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const poll = async () => {
      try {
        const r = await api<Run>('/api/runs/' + selected.id);
        if (live) setSelected(r);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    const timer = window.setInterval(poll, 650);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selected?.id]);
  useEffect(() => {
    if (selected && selected.status !== 'running' && nextDemo) {
      const next = nextDemo;
      setNextDemo(undefined);
      void (async () => {
        for (let i = 0; i < 10; i++) {
          try {
            const r = await api<Run>('/api/runs', next);
            setSelected(r);
            return;
          } catch (e) {
            if (!(e as Error).message.includes('active')) {
              setError((e as Error).message);
              return;
            }
            await new Promise((r) => window.setTimeout(r, 250));
          }
        }
        setError('Demo could not start its second run.');
      })();
    }
  }, [selected?.status, nextDemo]);
  async function perform(fn: () => Promise<void>) {
    setPending(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  function downloadJson() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenario.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function runDemo() {
    await perform(async () => {
      const d = await api<{ id: string; next: Scenario }>('/api/demo', {});
      setNextDemo(d.next);
      setSelected(await api<Run>('/api/runs/' + d.id));
      setView('result');
    });
  }
  const active = runs.some((r) => r.status === 'running');
  const stats = [
    ['Total runs', runs.length],
    ['Passed', runs.filter((r) => r.status === 'pass').length],
    ['Failed', runs.filter((r) => r.status === 'fail').length],
    ['Last result', runs[0]?.status.toUpperCase() || 'NO RUNS'],
  ];
  const updateStep = (i: number, patch: Partial<Step>) =>
    setScenario({
      ...scenario,
      steps: scenario.steps.map((s, j) => (i === j ? { ...s, ...patch } : s)),
    });
  const move = (i: number, d: number) => {
    const steps = [...scenario.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    setScenario({ ...scenario, steps });
  };
  return (
    <div className="app">
      <aside>
        <a className="brand" href="#" onClick={() => setView('dashboard')}>
          <span className="brandmark">
            <WifiOff size={20} />
          </span>
          LinkSunder<span className="version">0.1</span>
        </a>
        <div className="workspace">
          LOCAL WORKSPACE <span>●</span>
        </div>
        <nav>
          <button
            className={view === 'dashboard' ? 'nav active' : 'nav'}
            onClick={() => setView('dashboard')}
          >
            <LayoutDashboard size={17} /> Overview
          </button>
          <button
            className={view === 'create' ? 'nav active' : 'nav'}
            onClick={() => setView('create')}
          >
            <FlaskConical size={17} /> New test
          </button>
          <button
            className={view === 'settings' ? 'nav active' : 'nav'}
            onClick={() => setView('settings')}
          >
            <Settings size={17} /> Settings
          </button>
        </nav>
        <div className="aside-bottom">
          <ShieldCheck size={19} />
          <strong>Your machine. Your data.</strong>
          <p>
            No cloud. No account.
            <br />
            Just a more resilient web.
          </p>
          <button className="subtle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}{' '}
            {theme === 'dark' ? 'Light' : 'Dark'} appearance
          </button>
        </div>
      </aside>
      <main>
        <header>
          <span>
            Workspace <ChevronRight size={14} />{' '}
            {view === 'dashboard'
              ? 'Overview'
              : view === 'create'
                ? 'New test'
                : view === 'settings'
                  ? 'Settings'
                  : 'Run details'}
          </span>
          <small>
            <i /> Local engine · Chromium
          </small>
        </header>
        <div className="content">
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'dashboard' && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">RESILIENCE WORKSPACE</div>
                  <h1>Build for the unexpected.</h1>
                  <p>Break the connection. Find the bugs. Build a better web.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setScenario({ ...initial(), timeout });
                    setView('create');
                  }}
                >
                  <Plus size={17} /> New Test
                </button>
              </div>
              <section className="hero">
                <div>
                  <span className="pill">THE CONNECTION ISN’T ALWAYS PERFECT</span>
                  <h2>
                    Will your app hold up
                    <br />
                    when the network won’t?
                  </h2>
                  <p>
                    Catch lost drafts and fragile error states
                    <br />
                    before your users do.
                  </p>
                  <div className="buttons">
                    <button className="primary" onClick={() => setView('create')}>
                      <Plus size={17} /> Create a Test
                    </button>
                    <button className="secondary" disabled={pending || active} onClick={runDemo}>
                      <FlaskConical size={17} /> {pending ? 'Starting…' : 'Run Demo'}{' '}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <small>
                    Test your own website. The optional demo shows a real failure and recovery.
                  </small>
                </div>
                <div className="diagram" aria-hidden="true">
                  <div className="node">YOUR APP</div>
                  <div className="wire">
                    <span />×<span />
                  </div>
                  <div className="node network">
                    <WifiOff size={27} /> NETWORK
                  </div>
                  <div className="signal">
                    Connection lost.
                    <br />
                    <strong>Draft preserved?</strong>
                  </div>
                </div>
              </section>
              <div className="stats">
                {stats.map(([k, v]) => (
                  <article key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                    <Activity size={18} />
                  </article>
                ))}
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>
                    Recent runs <span className="count">{runs.length}</span>
                  </h2>
                  <span>Browser-local time · JSON reports use ISO timestamps</span>
                </div>
                {!runs.length ? (
                  <div className="empty">
                    <span className="empty-icon">
                      <FlaskConical size={29} />
                    </span>
                    <h3>Your first discovery starts here.</h3>
                    <p>
                      Run the demo or create a test for a site you own.
                      <br />
                      Every result comes from a real Chromium session.
                    </p>
                    <button className="secondary" onClick={() => setView('create')}>
                      Run Your First Test <ChevronRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Scenario</th>
                          <th>Result</th>
                          <th>Assertions</th>
                          <th>Duration</th>
                          <th>Started</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="runlink"
                                onClick={() => {
                                  setSelected(r);
                                  setView('result');
                                }}
                              >
                                {r.name}
                                <ChevronRight size={14} />
                              </button>
                              <small>{r.type}</small>
                            </td>
                            <td>
                              <span className={'badge ' + r.status}>{r.status}</span>
                            </td>
                            <td>
                              {r.passed} / {r.assertions}
                            </td>
                            <td>{(r.duration / 1000).toFixed(1)}s</td>
                            <td>{formatRunTimestamp(r.started)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div className="guide">
                <span>
                  01 <strong>Choose a target</strong>
                  <small>A local app or a site you own.</small>
                </span>
                <span>
                  02 <strong>Disrupt the network</strong>
                  <small>Offline, failed API or delayed response.</small>
                </span>
                <span>
                  03 <strong>Inspect the evidence</strong>
                  <small>Assertions, steps and portable reports.</small>
                </span>
              </div>
            </>
          )}
          {view === 'create' && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">SCENARIO BUILDER</div>
                  <h1>Make failure intentional.</h1>
                  <p>Define what should survive a connection problem.</p>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    const parsed = scenarioSchema.parse(scenario);
                    const r = await api<Run>('/api/runs', parsed);
                    setSelected(r);
                    setView('result');
                  });
                }}
              >
                <section className="panel form">
                  <h2>Test configuration</h2>
                  {notice && <p role="status">{notice}</p>}
                  <div className="buttons">
                    <button type="button" className="secondary" onClick={saveScenario}>
                      Save scenario
                    </button>
                  </div>
                  {savedScenarios.length > 0 && (
                    <label>
                      Saved scenarios
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const saved = savedScenarios.find((s) => s.name === e.target.value);
                          if (saved) {
                            setScenario(saved);
                            setNotice('Saved scenario loaded.');
                          }
                        }}
                      >
                        <option value="" disabled>
                          Choose a saved scenario
                        </option>
                        {savedScenarios.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="hint">
                    Saved scenarios stay on this computer and may contain your test inputs. With
                    custom steps, add Offline, Fail API or Delay API explicitly where the disruption
                    should happen.
                  </p>
                  <div className="columns">
                    <label>
                      Scenario name
                      <input
                        required
                        value={scenario.name}
                        maxLength={100}
                        onChange={(e) => setScenario({ ...scenario, name: e.target.value })}
                      />
                    </label>
                    <label>
                      Website URL
                      <input
                        type="url"
                        required
                        value={scenario.url}
                        onChange={(e) => setScenario({ ...scenario, url: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    Test type
                    <select
                      value={scenario.type}
                      onChange={(e) =>
                        setScenario({ ...scenario, type: e.target.value as Scenario['type'] })
                      }
                    >
                      <option value="offline">Offline Recovery</option>
                      <option value="failure">API Failure</option>
                      <option value="slow">Slow API Response</option>
                    </select>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={scenario.externalConsent}
                      onChange={(e) =>
                        setScenario({ ...scenario, externalConsent: e.target.checked })
                      }
                    />{' '}
                    I own or have permission to test this external site.
                  </label>
                  <p className="hint">
                    No steps? Quick Scan records observations only. Add Check Element or Check Field
                    Value to earn a PASS or FAIL.
                  </p>
                </section>
                <section className="panel form">
                  <div className="panel-head">
                    <h2>Scenario steps</h2>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setScenario({
                          ...scenario,
                          steps: [
                            ...scenario.steps,
                            {
                              action: 'check',
                              selector: '',
                              value: '',
                              path: '/api/messages',
                              delay: 1000,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={16} /> Add step
                    </button>
                  </div>
                  {scenario.steps.map((s, i) => (
                    <div className="stepedit" key={i}>
                      <span className="stepnum">{i + 1}</span>
                      <div className="stepfields">
                        <label className="sr-only" htmlFor={'action' + i}>
                          Step {i + 1} action
                        </label>
                        <select
                          id={'action' + i}
                          value={s.action}
                          onChange={(e) =>
                            updateStep(i, { action: e.target.value as Step['action'] })
                          }
                        >
                          {actions.map((a) => (
                            <option key={a} value={a}>
                              {labels[a]}
                            </option>
                          ))}
                        </select>
                        {['click', 'fill', 'check', 'value'].includes(s.action) && (
                          <input
                            aria-label={'Step ' + (i + 1) + ' selector'}
                            placeholder="CSS selector, e.g. #note"
                            required
                            value={s.selector}
                            onChange={(e) => updateStep(i, { selector: e.target.value })}
                          />
                        )}
                        {['fill', 'value'].includes(s.action) && (
                          <input
                            aria-label={'Step ' + (i + 1) + ' value'}
                            placeholder="Expected value"
                            value={s.value}
                            onChange={(e) => updateStep(i, { value: e.target.value })}
                          />
                        )}
                        {['fail', 'delay'].includes(s.action) && (
                          <input
                            aria-label="API path"
                            placeholder="/api/messages"
                            required
                            value={s.path}
                            onChange={(e) => updateStep(i, { path: e.target.value })}
                          />
                        )}
                        {s.action === 'delay' && (
                          <input
                            aria-label="Delay milliseconds"
                            type="number"
                            min="0"
                            max="15000"
                            value={s.delay}
                            onChange={(e) => updateStep(i, { delay: Number(e.target.value) })}
                          />
                        )}
                      </div>
                      <div className="stepbuttons">
                        <button
                          type="button"
                          disabled={i === 0}
                          aria-label="Move step up"
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={i === scenario.steps.length - 1}
                          aria-label="Move step down"
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove step"
                          onClick={() =>
                            setScenario({
                              ...scenario,
                              steps: scenario.steps.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
                <details className="panel form">
                  <summary>Advanced · privacy, timeout and JSON</summary>
                  <label>
                    Step timeout (ms)
                    <input
                      type="number"
                      min="1000"
                      max="30000"
                      value={scenario.timeout}
                      onChange={(e) =>
                        setScenario({ ...scenario, timeout: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={scenario.screenshots}
                      onChange={(e) => setScenario({ ...scenario, screenshots: e.target.checked })}
                    />{' '}
                    Allow screenshots (form fields are masked)
                  </label>
                  <label>
                    Additional sensitive selectors (one per line)
                    <textarea
                      value={scenario.maskSelectors.join('\n')}
                      onChange={(e) =>
                        setScenario({
                          ...scenario,
                          maskSelectors: e.target.value.split('\n').filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    Scenario JSON
                    <textarea
                      placeholder="Paste a scenario JSON"
                      value={json}
                      onChange={(e) => setJson(e.target.value)}
                    />
                  </label>
                  <div className="buttons">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        try {
                          setScenario(scenarioSchema.parse(JSON.parse(json)));
                          setError('');
                        } catch {
                          setError('Invalid scenario JSON. Check the schema and values.');
                        }
                      }}
                    >
                      Import JSON
                    </button>
                    <button type="button" className="secondary" onClick={downloadJson}>
                      Export JSON
                    </button>
                  </div>
                </details>
                <button className="primary" disabled={pending || active}>
                  {pending ? 'Starting Chromium…' : 'Run Test'} <ChevronRight size={16} />
                </button>
              </form>
            </>
          )}
          {view === 'result' && selected && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">EXECUTION / {selected.id.slice(0, 8)}</div>
                  <h1>{selected.name}</h1>
                  <p>
                    {selected.status === 'running'
                      ? 'Chromium is executing your scenario.'
                      : 'Evidence from a real browser session.'}
                  </p>
                </div>
                <span className={'badge ' + selected.status}>{selected.status}</span>
              </div>
              <div className="resultsummary panel">
                <div>
                  <span>Duration</span>
                  <strong>{(selected.duration / 1000).toFixed(1)}s</strong>
                </div>
                <div>
                  <span>Assertions passed</span>
                  <strong>
                    {selected.passed} / {selected.assertions}
                  </strong>
                </div>
                <div>
                  <span>Requests failed / injected</span>
                  <strong>
                    {selected.network.failed} / {selected.network.injected}
                  </strong>
                </div>
              </div>
              {selected.error && <div className="alert">{selected.error}</div>}
              {selected.advice && <p className="advice">{selected.advice}</p>}
              {selected.status === 'observed' && (
                <p className="advice">
                  No assertions were configured. These observations do not establish site health.
                </p>
              )}
              <section className="panel form">
                <h2>Execution timeline</h2>
                {selected.steps.map((s, i) => (
                  <div className="timeline" key={i}>
                    <span className={'badge ' + s.status}>
                      {s.status === 'pass' ? (
                        <Check size={15} />
                      ) : s.status === 'fail' ? (
                        <X size={15} />
                      ) : (
                        <Activity size={15} />
                      )}
                    </span>
                    <div>
                      <strong>{labels[s.action]}</strong>
                      <p>{s.message}</p>
                    </div>
                    <small>{s.duration} ms</small>
                  </div>
                ))}
              </section>
              {selected.screenshots.map((s, i) => (
                <img
                  className="capture"
                  src={s}
                  key={i}
                  alt={'Masked browser capture ' + (i + 1)}
                />
              ))}
              <div className="buttons">
                {selected.status === 'running' ? (
                  <button
                    className="secondary"
                    onClick={() => {
                      setNextDemo(undefined);
                      void perform(async () => {
                        await api('/api/cancel', {});
                      });
                    }}
                  >
                    Cancel run
                  </button>
                ) : (
                  ['html', 'json'].map((f) => (
                    <a className="secondary" key={f} href={'/api/reports/' + selected.id + '/' + f}>
                      <Download size={16} /> Download {f.toUpperCase()} Report
                    </a>
                  ))
                )}
              </div>
              <p className="hint">
                Reports contain screenshots only when explicitly enabled. Treat page content as
                private.
              </p>
            </>
          )}
          {view === 'settings' && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">WORKSPACE PREFERENCES</div>
                  <h1>A lab that stays local.</h1>
                  <p>Simple defaults. Explicit permissions.</p>
                </div>
              </div>
              <section className="panel form">
                <label>
                  Appearance
                  <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </label>
                <label>
                  Default step timeout (ms)
                  <input
                    type="number"
                    min="1000"
                    max="30000"
                    value={timeout}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTimeoutValue(v);
                      localStorage.setItem('timeout', String(v));
                    }}
                  />
                </label>
                <dl>
                  <dt>Report storage</dt>
                  <dd>
                    {reportDirectory}. Use Download Report to save a copy wherever you choose.
                  </dd>
                  <dt>Browser</dt>
                  <dd>
                    Isolated headless Chromium. Service workers blocked; no saved cookies or login
                    sessions.
                  </dd>
                  <dt>Execution security</dt>
                  <dd>
                    One active run. Loopback dashboard. External targets require consent. Other
                    local origins, private and metadata endpoints are blocked during external tests.
                  </dd>
                  <dt>Privacy</dt>
                  <dd>
                    No telemetry. No request bodies, headers or cookies in reports. Screenshots are
                    opt-in; form fields and configured selectors are masked.
                  </dd>
                </dl>
              </section>
            </>
          )}
          <footer>
            <span>
              LinkSunder <span className="muted">/</span> A small lab for a stronger web.
            </span>
            <span>LOCAL FIRST. OPEN SOURCE.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
