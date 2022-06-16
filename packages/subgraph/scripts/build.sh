#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

#################################################################
#####                     MAINNET                          ######
#################################################################

# Vault
vault_address_mainnet=0x3FB380e25930FF9DEf5493eF6B62Aa3D88394642
vault_block_mainnet=14384724

# Clock
clock_address_mainnet=0xba100000625a3754423978a60c9317c58a424e3d # BAL
clock_block_mainnet=14384724

# Agreement Factory V1
agreement_factory_v1_address_mainnet=0xD0b393744c71f6627F2B94da223c1b785b9D130c
agreement_factory_v1_block_mainnet=14384724

# Agreement Factory V2
agreement_factory_v2_address_mainnet=0x3989BaFcB0858c82e0BbDB010EcD6882BD0041cc
agreement_factory_v2_block_mainnet=14900728

#################################################################
#####                     POLYGON                          ######
#################################################################

# Vault
vault_address_matic=0x3FB380e25930FF9DEf5493eF6B62Aa3D88394642
vault_block_matic=25933113

# Clock
clock_address_matic=0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3 # BAL
clock_block_matic=25933113

# Agreement Factory V1
agreement_factory_v1_address_matic=0xe0E1faB5b3F46366fC92a0a0ed3fdDA5EeF094a8
agreement_factory_v1_block_matic=25933113

# Agreement Factory V2
agreement_factory_v2_address_matic=0x327321f8bDfb313D7d872401bB508836E027F0C9
agreement_factory_v2_block_matic=29395816

#################################################################
#####                       KOVAN                          ######
#################################################################

# Vault
vault_address_kovan=0x0fc4AA87dFfCD24697F4fb23dEDf95759761a764
vault_block_kovan=28813917

# Clock
clock_address_kovan=0xba100000625a3754423978a60c9317c58a424e3d # BAL
clock_block_kovan=28813917

# Agreement Factory V1
agreement_factory_v1_address_kovan=0x3661310ef010d8751b726d7aF5EbA458b96D956E
agreement_factory_v1_block_kovan=28813917

# Agreement Factory V2
agreement_factory_v2_address_kovan=
agreement_factory_v2_block_kovan=

#################################################################
#####                       SETUP                          ######
#################################################################

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

#################################################################
#####                       VAULT                          ######
#################################################################

# Load Vault start block
if [[ -z $VAULT_BLOCK ]]; then
  VAULT_BLOCK_VAR=vault_block_$NETWORK
  VAULT_BLOCK=${!VAULT_BLOCK_VAR}
fi
if [[ -z $VAULT_BLOCK ]]; then
  VAULT_BLOCK=0
fi

# Try loading Vault address if missing
if [[ -z $VAULT ]]; then
  VAULT_ADDRESS_VAR=vault_address_$NETWORK
  VAULT_ADDRESS=${!VAULT_ADDRESS_VAR}
fi

# Validate Vault address
if [[ -z $VAULT_ADDRESS ]]; then
  echo 'Please make sure a Vault address is provided'
  exit 1
fi

#################################################################
#####                        CLOCK                         ######
#################################################################

# Load Clock start block
if [[ -z $CLOCK_BLOCK ]]; then
  CLOCK_BLOCK_VAR=clock_block_$NETWORK
  CLOCK_BLOCK=${!CLOCK_BLOCK_VAR}
fi
if [[ -z $CLOCK_BLOCK ]]; then
  CLOCK_BLOCK=0
fi

# Try loading Clock address if missing
if [[ -z $CLOCK ]]; then
  CLOCK_ADDRESS_VAR=clock_address_$NETWORK
  CLOCK_ADDRESS=${!CLOCK_ADDRESS_VAR}
fi

# Validate Clock address
if [[ -z $CLOCK_ADDRESS ]]; then
  echo 'Please make sure a Clock address is provided'
  exit 1
fi

#################################################################
#####               AGREEMENT FACTORY V1                   ######
#################################################################

# Load Agreement Factory V1 start block
if [[ -z $AGREEMENT_FACTORY_V1_BLOCK ]]; then
  AGREEMENT_FACTORY_V1_BLOCK_VAR=agreement_factory_v1_block_$NETWORK
  AGREEMENT_FACTORY_V1_BLOCK=${!AGREEMENT_FACTORY_V1_BLOCK_VAR}
fi
if [[ -z $AGREEMENT_FACTORY_V1_BLOCK ]]; then
  AGREEMENT_FACTORY_V1_BLOCK=0
fi

# Try loading Agreement Factory V1 address if missing
if [[ -z $AGREEMENT_FACTORY_V1_ADDRESS ]]; then
  AGREEMENT_FACTORY_V1_ADDRESS_VAR=agreement_factory_v1_address_$NETWORK
  AGREEMENT_FACTORY_V1_ADDRESS=${!AGREEMENT_FACTORY_V1_ADDRESS_VAR}
fi

# Validate Agreement Factory V1 address
if [[ -z $AGREEMENT_FACTORY_V1_ADDRESS ]]; then
  echo 'Please make sure an Agreement Factory V1 address is provided'
  exit 1
fi

#################################################################
#####               AGREEMENT FACTORY V2                   ######
#################################################################

# Load Agreement Factory V2 start block
if [[ -z $AGREEMENT_FACTORY_V2_BLOCK ]]; then
  AGREEMENT_FACTORY_V2_BLOCK_VAR=agreement_factory_v2_block_$NETWORK
  AGREEMENT_FACTORY_V2_BLOCK=${!AGREEMENT_FACTORY_V2_BLOCK_VAR}
fi
if [[ -z $AGREEMENT_FACTORY_V2_BLOCK ]]; then
  AGREEMENT_FACTORY_V2_BLOCK=0
fi

# Try loading Agreement Factory V2 address if missing
if [[ -z $AGREEMENT_FACTORY_V2_ADDRESS ]]; then
  AGREEMENT_FACTORY_V2_ADDRESS_VAR=agreement_factory_v2_address_$NETWORK
  AGREEMENT_FACTORY_V2_ADDRESS=${!AGREEMENT_FACTORY_V2_ADDRESS_VAR}
fi

# Validate Agreement Factory V2 address
if [[ -z $AGREEMENT_FACTORY_V2_ADDRESS ]]; then
  echo 'Please make sure an Agreement Factory V2 address is provided'
  exit 1
fi

#################################################################
#####                     FINALIZE                         ######
#################################################################

# Remove previous manifest if there is any
if [ -f subgraph.yaml ]; then
  echo 'Removing previous subgraph manifest...'
  rm subgraph.yaml
fi

# Build subgraph manifest for requested variables
echo "Preparing new subgraph manifest for Vault address ${VAULT} and network ${NETWORK}"
cp subgraph.template.yaml subgraph.yaml
sed -i -e "s/{{network}}/${ENV}/g" subgraph.yaml
sed -i -e "s/{{vaultAddress}}/${VAULT_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{vaultBlock}}/${VAULT_BLOCK}/g" subgraph.yaml
sed -i -e "s/{{clockAddress}}/${CLOCK_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{clockBlock}}/${CLOCK_BLOCK}/g" subgraph.yaml
sed -i -e "s/{{agreementFactoryV1Address}}/${AGREEMENT_FACTORY_V1_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{agreementFactoryV1Block}}/${AGREEMENT_FACTORY_V1_BLOCK}/g" subgraph.yaml
sed -i -e "s/{{agreementFactoryV2Address}}/${AGREEMENT_FACTORY_V2_ADDRESS}/g" subgraph.yaml
sed -i -e "s/{{agreementFactoryV2Block}}/${AGREEMENT_FACTORY_V2_BLOCK}/g" subgraph.yaml
rm -f subgraph.yaml-e

# Run codegen and build
rm -rf ./types && yarn graph codegen -o types
yarn graph build
