#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Vault addresses
vault_localhost=0xCfEB869F69431e42cdB54A4F4f105C19C080A601
vault_ropsten=0x0000000000000000000000000000000000000001
vault_rinkeby=0x4543232325e6902884844f9B8046A28172379203
vault_mainnet=0x0000000000000000000000000000000000000001

# Agreement factory addresses
agreement_factory_localhost=0x254dffcd3277C0b1660F6d42EFbB754edaBAbC2B
agreement_factory_ropsten=0x0000000000000000000000000000000000000002
agreement_factory_rinkeby=0x65a40282fc52252806102d9723d1d561f37Fd60F
agreement_factory_mainnet=0x0000000000000000000000000000000000000002

# Deployment block numbers
start_block_ropsten=
start_block_rinkeby=9212247
start_block_mainnet=

# Validate network
networks=(localhost ropsten rinkeby mainnet)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either localhost, ropsten, rinkeby, or mainnet.'
  exit 1
fi

# Use mainnet network in case of local deployment
if [[ "$NETWORK" = "localhost" ]]; then
  ENV='mainnet'
else
  ENV=${NETWORK}
fi

# Load start block
if [[ -z $START_BLOCK ]]; then
  START_BLOCK_VAR=start_block_$NETWORK
  START_BLOCK=${!START_BLOCK_VAR}
fi
if [[ -z $START_BLOCK ]]; then
  START_BLOCK=0
fi

# Try loading Vault address if missing
if [[ -z $VAULT ]]; then
  VAULT_VAR=vault_$NETWORK
  VAULT=${!VAULT_VAR}
fi

# Validate court address
if [[ -z $VAULT ]]; then
  echo 'Please make sure a Vault address is provided'
  exit 1
fi

# Try loading Agreement Factory address if missing
if [[ -z $AGREEMENT_FACTORY ]]; then
  AGREEMENT_FACTORY_VAR=agreement_factory_$NETWORK
  AGREEMENT_FACTORY=${!AGREEMENT_FACTORY_VAR}
fi

# Validate court address
if [[ -z $AGREEMENT_FACTORY ]]; then
  echo 'Please make sure an Agreement Factory address is provided'
  exit 1
fi

# Remove previous manifest if there is any
if [ -f subgraph.yaml ]; then
  echo 'Removing previous subgraph manifest...'
  rm subgraph.yaml
fi

# Build subgraph manifest for requested variables
echo "Preparing new subgraph manifest for Vault address ${VAULT} and network ${NETWORK}"
cp subgraph.template.yaml subgraph.yaml
sed -i -e "s/{{network}}/${ENV}/g" subgraph.yaml
sed -i -e "s/{{vault}}/${VAULT}/g" subgraph.yaml
sed -i -e "s/{{agreementFactory}}/${AGREEMENT_FACTORY}/g" subgraph.yaml
sed -i -e "s/{{startBlock}}/${START_BLOCK}/g" subgraph.yaml
rm -f subgraph.yaml-e

# Run codegen and build
rm -rf ./types && yarn graph codegen -o types
yarn graph build
