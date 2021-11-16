#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Vault addresses
vault_localhost=0x646A336CD183dc947D3AdbEfb19c3cF637720318
vault_kovan=0x48e978Dc6Fe305Bbf1BE4d91db9fc2899fb10b4E
vault_rinkeby=0x3683799B950B9680Fe9B5169e641e6DA5Fc751Ad
vault_mainnet=0x0000000000000000000000000000000000000001

# Agreement factory addresses
agreement_factory_localhost=0xCfEB869F69431e42cdB54A4F4f105C19C080A601
agreement_factory_kovan=0x91aAe4f5A9e101bc88164Ef61814ce301a1fdDb4
agreement_factory_rinkeby=0x5b34CC8E36B218C734cE4ACE32F8e6828f4F04Eb
agreement_factory_mainnet=0x0000000000000000000000000000000000000002

# Deployment block numbers
start_block_kovan=28398276
start_block_rinkeby=9264082
start_block_mainnet=

# Validate network
networks=(localhost kovan rinkeby mainnet)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either localhost, kovan, rinkeby, or mainnet.'
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

# Validate Vault address
if [[ -z $VAULT ]]; then
  echo 'Please make sure a Vault address is provided'
  exit 1
fi

# Try loading Agreement Factory address if missing
if [[ -z $AGREEMENT_FACTORY ]]; then
  AGREEMENT_FACTORY_VAR=agreement_factory_$NETWORK
  AGREEMENT_FACTORY=${!AGREEMENT_FACTORY_VAR}
fi

# Validate Agreement Factory address
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
