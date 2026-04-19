import { get_encoding, encoding_for_model } from "@dqbd/tiktoken";
import models from "./models";

class TokenManager {
  constructor() {
    this.encoders = new Map();
  }

  getEncoder(model) {
    const encodingName = models[model]?.tokenizer || 'cl100k_base'
    if (!this.encoders.has(encodingName)) {
      let enc;
      try {
        enc = encoding_for_model(model)
      } catch (error) {
        enc = get_encoding(encodingName)
      }
      this.encoders.set(encodingName, enc);
    }
    return this.encoders.get(encodingName);
  }

  countTokens(model, text) {
    const enc = this.getEncoder(model);
    return enc.encode(text).length;
  }
}

export const tokenManager = new TokenManager();