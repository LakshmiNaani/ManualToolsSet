# Stage: Process Files
Run the main processing pipeline against the input data. Make sure Stage 1 is complete before starting here.

### Step 1: Run Main Script
Execute the processing script pointing to your input and output directories.

```bash
python process.py --input {{INPUT_DIR}} --output {{OUTPUT_DIR=/tmp/output}} --workers {{WORKERS=4}}
```

### Step 2: Verify Output
Check that the expected output files were created.

```bash
ls -lh {{OUTPUT_DIR=/tmp/output}}
```

### Step 3: Run Quality Checks
Run automated validation on the processed output.

```bash
python validate.py --dir {{OUTPUT_DIR=/tmp/output}} --strict
```

### Step 4: Archive Results
Copy final results to the archive location for record keeping.

```bash
cp -r {{OUTPUT_DIR=/tmp/output}} {{ARCHIVE_DIR=/mnt/archive}}/$(date +%Y%m%d)
```
