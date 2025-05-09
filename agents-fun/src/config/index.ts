import {
  type Character,
  ModelProviderName,
  elizaLogger,
  settings,
  stringToUuid,
  validateCharacterConfig,
} from "@elizaos/core";
import fs from "fs";
import path from "path";
import yargs from "yargs";

const AGENT_STORE_PATH = process.env
  .CONNECTION_CONFIGS_CONFIG_STORE_PATH as string;
const AGENT_BASE_PATH = path.resolve(AGENT_STORE_PATH, "..");
const AGENT_DEPLOYMENT_PATH = path.join(AGENT_BASE_PATH, "deployment");
const AGENT_WORKING_PATH = path.join(AGENT_DEPLOYMENT_PATH, "agent");
const AGENT_WALLET_PATH = path.join(
  AGENT_WORKING_PATH,
  "ethereum_private_key.txt",
);

export const AGENT_PATHS = {
  AGENT_STORE_PATH: AGENT_STORE_PATH,
  AGENT_BASE_PATH: AGENT_BASE_PATH,
  AGENT_DEPLOYMENT_PATH: AGENT_DEPLOYMENT_PATH,
  AGENT_WORKING_PATH: AGENT_WORKING_PATH,
  AGENT_WALLET_PATH: AGENT_WALLET_PATH,
};

export function prepareAgentPaths(): string {
  elizaLogger.log("=========CURRENT RUNTIME PATHS=========");
  elizaLogger.log(JSON.stringify(AGENT_PATHS, null, 2));
  elizaLogger.log("=======================================");

  try {
    // Read the private key file
    const privateKeyRaw = fs.readFileSync(AGENT_WALLET_PATH, "utf-8");

    // Strip spaces from the start and end
    const privateKey = privateKeyRaw.trim();

    return privateKey;
  } catch (error) {
    console.error("Error reading the private key file:", error);
    process.exit(1);
  }
}

export const SUBGRAPH_URLS = {
  USER_SUBGRAPH_URL:
    "https://subgraph.autonolas.tech/subgraphs/name/autonolas-base" as string,
  MEME_SUBGRAPH_URL:
    "https://agentsfun-indexer-production.up.railway.app" as string,
} as const;

export const CONTRACTS = {
  MEME_FACTORY_CONTRACT: "0x82a9c823332518c32a0c0edc050ef00934cf04d4" as string,
} as const;

export const CHAINS = {
  BASE: {
    CHAIN_ID: "8453" as string,
  },
} as const;

const OPENAI_SETTINGS = {
  USE_OPENAI_EMBEDDING: "TRUE" as string,
  USE_OPENAI_EMBEDDING_TYPE: "TRUE" as string,
} as const;

export function parseArguments(): {
  character?: string;
  characters?: string;
} {
  try {
    elizaLogger.log("Parsing arguments..: ", process.argv.slice(2));
    return yargs(process.argv.slice(2))
      .option("character", {
        type: "string",
        description: "Path to the character JSON file",
      })
      .option("characters", {
        type: "string",
        description: "Comma separated list of paths to character JSON files",
      })
      .parseSync();
  } catch (error) {
    console.error("Error parsing arguments:", error);
    return {};
  }
}

export async function loadCharacters(
  charactersArg: string,
): Promise<Character[]> {
  let characterPaths = charactersArg?.split(",").map((filePath) => {
    if (path.basename(filePath) === filePath) {
      filePath = "../characters/" + filePath;
    }
    return path.resolve(process.cwd(), filePath.trim());
  });

  const loadedCharacters: Character[] = [];

  if (characterPaths?.length > 0) {
    for (const path of characterPaths) {
      try {
        const character = JSON.parse(fs.readFileSync(path, "utf8"));

        validateCharacterConfig(character);

        loadedCharacters.push(character);
      } catch (e) {
        console.error(`Error loading character from ${path}: ${e}`);
        // don't continue to load if a specified file is not found
        process.exit(1);
      }
    }
  }

  return loadedCharacters;
}

export function getTokenForProvider(
  provider: ModelProviderName,
  character: Character,
): string | undefined {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return (
        character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY
      );
    case ModelProviderName.LLAMACLOUD:
      return (
        character.settings?.secrets?.LLAMACLOUD_API_KEY ||
        settings.LLAMACLOUD_API_KEY ||
        character.settings?.secrets?.TOGETHER_API_KEY ||
        settings.TOGETHER_API_KEY ||
        character.settings?.secrets?.XAI_API_KEY ||
        settings.XAI_API_KEY ||
        character.settings?.secrets?.OPENAI_API_KEY ||
        settings.OPENAI_API_KEY
      );
    case ModelProviderName.ANTHROPIC:
      return (
        character.settings?.secrets?.ANTHROPIC_API_KEY ||
        character.settings?.secrets?.CLAUDE_API_KEY ||
        settings.ANTHROPIC_API_KEY ||
        settings.CLAUDE_API_KEY
      );
    case ModelProviderName.REDPILL:
      return (
        character.settings?.secrets?.REDPILL_API_KEY || settings.REDPILL_API_KEY
      );
    case ModelProviderName.OPENROUTER:
      return (
        character.settings?.secrets?.OPENROUTER || settings.OPENROUTER_API_KEY
      );
    case ModelProviderName.GROK:
      return character.settings?.secrets?.GROK_API_KEY || settings.GROK_API_KEY;
    case ModelProviderName.HEURIST:
      return (
        character.settings?.secrets?.HEURIST_API_KEY || settings.HEURIST_API_KEY
      );
    case ModelProviderName.GROQ:
      return character.settings?.secrets?.GROQ_API_KEY || settings.GROQ_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Loads and configures the character from CLI arguments.
 */
export async function loadCharacterFromArgs(): Promise<Character> {
  const args = parseArguments();
  const charactersArg = args.characters || args.character;
  let characters: Character[] = [];
  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }
  if (characters.length === 0) {
    elizaLogger.error("No characters loaded, exiting...");
    process.exit(1);
  }
  // Use the first character from the list as the active character.
  const character = characters[0];
  character.id ??= stringToUuid(character.name);
  character.username ??= character.name;
  character.settings ??= {};
  return character;
}

/**
 * Retrieves the safe contract address from the environment variable.
 */
export function fetchSafeAddress(): string {
  const safeAddressDict =
    process.env.CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES;
  if (!safeAddressDict) {
    console.warn(
      "Safe address dictionary is not defined in the environment variables.",
    );
    return "";
  }
  try {
    const safeAddressObj = JSON.parse(safeAddressDict);
    if (safeAddressObj.base) return safeAddressObj.base;
    else {
      console.error("Base key not found in the safe address dictionary.");
      process.exit(1);
    }
  } catch (error) {
    console.error("Failed to parse safe address dictionary:", error);
    process.exit(1);
  }
}

/**
 * Collects all required secrets from environment variables.
 */
export function getSecrets(safeAddress: string): Record<string, string> {
  // Collect wallet address from address path
  const privateKey = prepareAgentPaths();

  return {
    OPENAI_API_KEY: process.env
      .CONNECTION_CONFIGS_CONFIG_OPENAI_API_KEY as string,
    TWITTER_USERNAME: process.env
      .CONNECTION_CONFIGS_CONFIG_TWIKIT_USERNAME as string,
    TWITTER_PASSWORD: process.env
      .CONNECTION_CONFIGS_CONFIG_TWIKIT_PASSWORD as string,
    TWITTER_EMAIL: process.env.CONNECTION_CONFIGS_CONFIG_TWIKIT_EMAIL as string,
    AGENT_EOA_PK: privateKey as string,
    BASE_LEDGER_RPC: process.env
      .CONNECTION_CONFIGS_CONFIG_BASE_LEDGER_RPC as string,
    MEME_FACTORY_CONTRACT: CONTRACTS.MEME_FACTORY_CONTRACT as string,
    SAFE_ADDRESS_DICT: process.env
      .CONNECTION_CONFIGS_CONFIG_SAFE_CONTRACT_ADDRESSES as string,
    SAFE_ADDRESS: safeAddress,
    USE_OPENAI_EMBEDDING: OPENAI_SETTINGS.USE_OPENAI_EMBEDDING as string,
    USE_OPENAI_EMBEDDING_TYPE: OPENAI_SETTINGS.USE_OPENAI_EMBEDDING_TYPE as string,
    SUBGRAPH_URL: SUBGRAPH_URLS.USER_SUBGRAPH_URL as string,
    MEME_SUBGRAPH_URL: SUBGRAPH_URLS.MEME_SUBGRAPH_URL as string,
    CHAIN_ID: CHAINS.BASE.CHAIN_ID as string,
  };
}

export const ROOMS = {
  START: "START",
  TOKEN_INTERACTION: "TOKEN_INTERACTION",
  TWITTER_INTERACTION: "TWITTER_INTERACTION",
} as const;
