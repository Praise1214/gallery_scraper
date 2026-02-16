/**
 * ═══════════════════════════════════════════════════════════════
 * GOOGLE SHEETS EXPORT TEST SCRIPT
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests the Google Sheets integration by pushing sample data.
 * Run this before running the full scraper to verify credentials work.
 *
 * Usage:
 *   1. Fill in your credentials below (or in test-sheets-config.json)
 *   2. Run: node test-sheets-export.js
 *   3. Check your Google Sheet for the test data
 */

import { google } from 'googleapis';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION - Fill these in!
// ═══════════════════════════════════════════════════════════════

// Option 1: Load from config file (recommended)
let config = {};
try {
    if (fs.existsSync('./test-sheets-config.json')) {
        config = JSON.parse(fs.readFileSync('./test-sheets-config.json', 'utf-8'));
        console.log('✅ Loaded config from test-sheets-config.json');
    }
} catch (e) {
    console.log('⚠️  No config file found, using inline credentials');
}

// Option 2: Inline credentials (fill these in if not using config file)
const SPREADSHEET_ID = config.spreadsheetId || 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = config.sheetName || 'Galleries';
const CLIENT_EMAIL = config.clientEmail || 'YOUR_SERVICE_ACCOUNT_EMAIL@project.iam.gserviceaccount.com';
const PRIVATE_KEY = (config.privateKey || '-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n').replace(/\\n/g, '\n');

// ═══════════════════════════════════════════════════════════════
// TEST DATA - Sample gallery records
// ═══════════════════════════════════════════════════════════════

const TEST_RECORDS = [
    {
        gallery_name: 'TEST - Modern Art Gallery',
        email: 'test1@example.com',
        all_emails: 'test1@example.com, info@example.com',
        website: 'https://example.com/gallery1',
        phone: '(555) 123-4567',
        all_phones: '(555) 123-4567',
        address: '123 Art Street',
        city: 'New York',
        state: 'NY',
        source_url: 'https://artgalleries.com/new-york/new-york/modern-art-gallery/',
        scraped_at: new Date().toISOString(),
        status: '',
        sequence_step: 0,
        last_contact_date: '',
        response_date: '',
        unsubscribe: 'FALSE',
        do_not_contact: 'FALSE',
        notes: 'Test record - delete me'
    },
    {
        gallery_name: 'TEST - Contemporary Arts Center',
        email: 'test2@example.com',
        all_emails: 'test2@example.com',
        website: 'https://example.com/gallery2',
        phone: '(555) 987-6543',
        all_phones: '(555) 987-6543',
        address: '456 Gallery Blvd',
        city: 'Los Angeles',
        state: 'CA',
        source_url: 'https://artgalleries.com/california/los-angeles/contemporary-arts/',
        scraped_at: new Date().toISOString(),
        status: '',
        sequence_step: 0,
        last_contact_date: '',
        response_date: '',
        unsubscribe: 'FALSE',
        do_not_contact: 'FALSE',
        notes: 'Test record - delete me'
    }
];

// Column headers for the sheet
const HEADERS = [
    'gallery_name', 'email', 'all_emails', 'website', 'phone', 'all_phones',
    'address', 'city', 'state', 'source_url', 'scraped_at',
    'status', 'sequence_step', 'last_contact_date', 'response_date',
    'unsubscribe', 'do_not_contact', 'notes'
];

// ═══════════════════════════════════════════════════════════════
// MAIN TEST FUNCTION
// ═══════════════════════════════════════════════════════════════

async function testGoogleSheetsExport() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  GOOGLE SHEETS EXPORT TEST');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Validate config
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE' ||
        CLIENT_EMAIL === 'YOUR_SERVICE_ACCOUNT_EMAIL@project.iam.gserviceaccount.com' ||
        PRIVATE_KEY.includes('YOUR_KEY_HERE')) {
        console.error('❌ ERROR: Please fill in your credentials!');
        console.log('\nYou can either:');
        console.log('  1. Edit this file and fill in SPREADSHEET_ID, CLIENT_EMAIL, PRIVATE_KEY');
        console.log('  2. Create test-sheets-config.json with your credentials:\n');
        console.log(`     {
       "spreadsheetId": "your-spreadsheet-id",
       "sheetName": "Galleries",
       "clientEmail": "your-service@project.iam.gserviceaccount.com",
       "privateKey": "-----BEGIN PRIVATE KEY-----\\nYOUR_KEY\\n-----END PRIVATE KEY-----\\n"
     }`);
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   Spreadsheet ID: ${SPREADSHEET_ID.substring(0, 20)}...`);
    console.log(`   Sheet Name: ${SHEET_NAME}`);
    console.log(`   Service Account: ${CLIENT_EMAIL}`);
    console.log('');

    try {
        // Step 1: Authenticate with Google
        console.log('🔐 Step 1: Authenticating with Google...');

        const auth = new google.auth.JWT(
            CLIENT_EMAIL,
            null,
            PRIVATE_KEY,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });
        console.log('   ✅ Authentication successful!\n');

        // Step 2: Check if sheet exists and get current data
        console.log('📊 Step 2: Checking spreadsheet access...');

        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        console.log(`   ✅ Found spreadsheet: "${spreadsheet.data.properties.title}"`);

        const sheetExists = spreadsheet.data.sheets.some(
            s => s.properties.title === SHEET_NAME
        );

        if (sheetExists) {
            console.log(`   ✅ Sheet "${SHEET_NAME}" exists\n`);
        } else {
            console.log(`   ⚠️  Sheet "${SHEET_NAME}" not found, will create it\n`);

            // Create the sheet
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: SHEET_NAME }
                        }
                    }]
                }
            });
            console.log(`   ✅ Created sheet "${SHEET_NAME}"\n`);
        }

        // Step 3: Check if headers exist
        console.log('📝 Step 3: Checking for header row...');

        const headerCheck = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:R1`
        });

        const existingHeaders = headerCheck.data.values?.[0] || [];

        if (existingHeaders.length === 0) {
            console.log('   📝 No headers found, writing header row...');

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [HEADERS]
                }
            });
            console.log('   ✅ Header row written\n');
        } else {
            console.log(`   ✅ Headers already exist (${existingHeaders.length} columns)\n`);
        }

        // Step 4: Append test data
        console.log('📤 Step 4: Appending test data...');
        console.log(`   Writing ${TEST_RECORDS.length} test records...`);

        const dataRows = TEST_RECORDS.map(record =>
            HEADERS.map(header => record[header] || '')
        );

        const appendResult = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:R`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: dataRows
            }
        });

        console.log(`   ✅ Successfully appended ${TEST_RECORDS.length} rows`);
        console.log(`   📍 Updated range: ${appendResult.data.updates.updatedRange}\n`);

        // Step 5: Verify data was written
        console.log('✔️  Step 5: Verifying data...');

        const verifyResult = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:B`
        });

        const totalRows = verifyResult.data.values?.length || 0;
        console.log(`   ✅ Total rows in sheet: ${totalRows} (including header)\n`);

        // Success!
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  ✅ TEST PASSED! Google Sheets export is working!');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n📌 Next steps:');
        console.log('   1. Open your Google Sheet to see the test data');
        console.log('   2. Delete the test rows (marked with "Test record - delete me")');
        console.log('   3. Update input-example.json with your credentials');
        console.log('   4. Set "googleSheetsExport": true');
        console.log('   5. Run the full scraper!\n');

        console.log(`🔗 Open your sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);

    } catch (error) {
        console.error('\n═══════════════════════════════════════════════════════════════');
        console.error('  ❌ TEST FAILED');
        console.error('═══════════════════════════════════════════════════════════════\n');

        if (error.message.includes('invalid_grant')) {
            console.error('Error: Invalid credentials');
            console.error('  - Check that your private key is correct');
            console.error('  - Make sure the service account exists\n');
        } else if (error.message.includes('not found')) {
            console.error('Error: Spreadsheet not found');
            console.error('  - Check that the spreadsheet ID is correct');
            console.error('  - Make sure the sheet is shared with the service account\n');
        } else if (error.message.includes('permission')) {
            console.error('Error: Permission denied');
            console.error('  - Share the Google Sheet with your service account email');
            console.error(`  - Service account: ${CLIENT_EMAIL}`);
            console.error('  - Give it "Editor" access\n');
        } else {
            console.error(`Error: ${error.message}\n`);
        }

        console.error('Full error:', error);
        process.exit(1);
    }
}

// Run the test
testGoogleSheetsExport();
