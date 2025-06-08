// netlify/functions/process-audio.js
const https = require('https');
const http = require('http');
const { URL } = require('url');

exports.handler = async (event, context) => {
  // Handle CORS for browser requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { cardName, cardDesc, cardId } = JSON.parse(event.body);
    
    // Parse the card description to extract information
    const parsedInfo = parseCardDescription(cardDesc);
    
    if (!parsedInfo.audioUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'No audio URL found in card description. Please include "Audio URL: your-url-here"' 
        })
      };
    }

    // Validate audio URL
    if (!isValidAudioUrl(parsedInfo.audioUrl)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid audio URL format or unsupported file type' 
        })
      };
    }

    // Process and return the structured data
    const processedData = {
      title: cardName,
      description: parsedInfo.description || '',
      audioUrl: parsedInfo.audioUrl,
      tags: parsedInfo.tags || '',
      cardId: cardId,
      success: true
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(processedData)
    };

  } catch (error) {
    console.error('Processing error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process card data', 
        details: error.message 
      })
    };
  }
};

function parseCardDescription(description) {
  const result = {
    audioUrl: null,
    description: '',
    tags: ''
  };

  if (!description) return result;

  const lines = description.split('\n');
  let descriptionLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.toLowerCase().startsWith('audio url:')) {
      // Extract audio URL
      result.audioUrl = trimmed.substring(10).trim();
    } else if (trimmed.toLowerCase().startsWith('description:')) {
      // Extract description
      result.description = trimmed.substring(12).trim();
    } else if (trimmed.toLowerCase().startsWith('tags:')) {
      // Extract tags
      result.tags = trimmed.substring(5).trim();
    } else if (trimmed && !trimmed.includes(':')) {
      // Add other lines to description
      descriptionLines.push(trimmed);
    }
  }

  // If no explicit description was found, use other lines
  if (!result.description && descriptionLines.length > 0) {
    result.description = descriptionLines.join(' ');
  }

  return result;
}

function isValidAudioUrl(url) {
  try {
    const parsedUrl = new URL(url);
    
    // Check if it's HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Check for common audio file extensions
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const pathname = parsedUrl.pathname.toLowerCase();
    
    return audioExtensions.some(ext => pathname.endsWith(ext));
  } catch (error) {
    return false;
  }
}

// Helper function to download file (for future use if needed)
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    }).on('error', reject);
  });
}
