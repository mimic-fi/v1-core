#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Vault addresses
vault_localhost=0x3661310ef010d8751b726d7aF5EbA458b96D956E
vault_kovan=0x0fc4AA87dFfCD24697F4fb23dEDf95759761a764
vault_mainnet=0x0fc4AA87dFfCD24697F4fb23dEDf95759761a764
vault_matic=0x0fc4AA87dFfCD24697F4fb23dEDf95759761a764

# Agreement factory addresses
agreement_factory_localhost=0x3661310ef010d8751b726d7aF5EbA458b96D956E
agreement_factory_kovan=0x3661310ef010d8751b726d7aF5EbA458b96D956E
agreement_factory_mainnet=0x3661310ef010d8751b726d7aF5EbA458b96D956E
agreement_factory_matic=0x3661310ef010d8751b726d7aF5EbA458b96D956E

# Deployment block numbers
start_block_kovan=28813917
start_block_mainnet=13760565
start_block_matic=22790000

# Validate network
networks=(localhost kovan rinkeby mainnet matic)
if [[ -z $NETWORK || ! " ${networks[@]} " =~ " ${NETWORK} " ]]; then
  echo 'Please make sure the network provided is either localhost, kovan, rinkeby, mainnet, or matic.'
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
