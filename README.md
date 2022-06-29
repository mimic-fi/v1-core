<h1 align="center">
  <a href="https://mimic.fi"><img src="https://www.mimic.fi/static/media/navbar-logo.d79d70dab1c7bd176b11b74829ed33e7.svg" alt="Mimic Finance" width="200"></a> 
</h1>

<h4 align="center">An automated treasury management protocol.</h4>

<p align="center">
  <a href="https://github.com/mimic-fi/chainlink-price-oracle/actions/workflows/ci.yml">
    <img src="https://github.com/mimic-fi/chainlink-price-oracle/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://badge.fury.io/js/@mimic-fi%2Fv1-vault">
    <img src="https://badge.fury.io/js/@mimic-fi%2Fv1-vault.svg" alt="NPM">
  </a>
  <a href="https://discord.gg/zN2QkTB3">
    <img src="https://img.shields.io/discourse/status?server=https%3A%2F%2Fmeta.discourse.org" alt="Discord">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-GLP_3.0-green">
  </a>
</p>

<p align="center">
  <a href="#content">Content</a> •
  <a href="#setup">Setup</a> •
  <a href="#security">Security</a> •
  <a href="#license">License</a>
</p>

---

## Content 

This monorepo holds the key components of the Mimic protocol:

- [Vault](./packages/vault): Nexus between Mimic wallets and strategies – orchestrator of the protocol rules.
- [Portfolios](./packages/portfolios): Custom implementation of a Mimic wallet to interact with the Vault.
- [Benchmark](./packages/benchmark): Benchmark scripts to perform integration and gas-cost tests.
- [Helpers](./packages/helpers): Library of typescript helpers used among all Mimic repositories.
- [Subgraph](./packages/subgraph): Vault's subgraph mainly used to populate information for the UI.

## Setup

To set up this project you'll need [git](https://git-scm.com) and [yarn](https://classic.yarnpkg.com) installed. 
From your command line:

```bash
# Clone this repository
$ git clone https://github.com/mimic-fi/core

# Go into the repository
$ cd core

# Install dependencies
$ yarn
```

## Security

<blockquote style="background: rgba(197,127,66,0.34); border: #ffffff6b; text: #f5fffa">
  <h5 style="color: rgba(225,111,12,0.82)">⚠️ Auditing</h5>
  <p>The status of our contracts are considered as experimental and should be used at your own risk.</p>
</blockquote>

Even though all our smart contracts have been reviewed and supervised with security researchers, currently we are going
through a formal audit process with one of the top firms in the industry. We will disclose the results and takeovers as 
soon as we finish the process.

Hopefully soon we will be able to communicate a bug bounty program for the hacker community. However, if you found any 
potential issue in any of our smart contracts or in any piece of code you consider critical for the safety of the 
protocol, please contact us through <a href="mailto:security@mimic.fi">security@mimic.fi</a>.

## License

GPL 3.0

---

> Website [mimic.fi](https://mimic.fi) &nbsp;&middot;&nbsp;
> GitHub [@mimic-fi](https://github.com/mimic-fi) &nbsp;&middot;&nbsp;
> Twitter [@mimicfi](https://twitter.com/mimicfi) &nbsp;&middot;&nbsp;
> Discord [mimic](https://discord.gg/zN2QkTB3)
