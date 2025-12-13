# Quick Import Guide

## ❌ Don't Import These Files:
- **"Content Calendar.csv"** - This is OUTPUT (generated calendars), not INPUT
- **"Posts.csv"** - Reference data only, not needed for calendar generation
- **"Comments.csv"** - Reference data only, not needed for calendar generation

## ✅ Import These Files (in this order):

### 1. **Company.csv** (Required)
**Columns you have:**
- Name
- Website
- Description
- Subreddits (comma-separated list)
- Number of posts per week

**What it does:**
- Imports company info
- Parses subreddits from the "Subreddits" column
- Sets posts per week value

### 2. **Personas.csv** (Required)
**Columns you have:**
- Username
- Info

**What it does:**
- Creates personas from Username + Info
- Uses Username as the persona name
- Defaults tone to 'casual' (you can add a Tone column if you want)

### 3. **Queries.csv** (Required)
**Columns you have:**
- keyword_id (ignored)
- keyword

**What it does:**
- Imports keywords as queries
- Defaults intent to 'question' (you can add an Intent column if you want)

### 4. **Subreddits.csv** (Optional)
Only needed if subreddits aren't in the Company sheet's "Subreddits" column.

---

## Import Order:

1. **Company.csv** first (sets up company and subreddits)
2. **Personas.csv** second
3. **Queries.csv** third

After importing all three, you should see:
- ✅ Company info filled in
- ✅ Personas listed (at least 2)
- ✅ Subreddits listed (at least 1)
- ✅ Queries listed (at least 1)
- ✅ Posts per week set

Then click **"Generate This Week's Calendar"**!

---

## Troubleshooting:

**"Could not detect data type"**
- Make sure you're importing INPUT files, not OUTPUT files
- Check that your CSV has a header row
- Verify column names match: Name, Username, keyword, etc.

**"This appears to be a Content Calendar output file"**
- You're trying to import a generated calendar
- Import your INPUT data files instead (Company, Personas, Queries)

