package android.print;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;

import java.io.File;

/**
 * Drives a PrintDocumentAdapter straight to a file, with no print dialog.
 *
 * This class lives in the android.print package on purpose, and it is the only
 * reason it exists. PrintDocumentAdapter.LayoutResultCallback and
 * WriteResultCallback both have package-private constructors, so they cannot be
 * subclassed from application code — being inside the same package is what
 * makes writing a PDF silently possible at all.
 *
 * The alternative is PrintManager, which always shows the system print sheet.
 * That still works and is what PdfPrintPlugin falls back to; it just costs the
 * farmer an extra tap on "Save as PDF" for the identical file.
 */
public final class PdfWriter {

    public interface Callback {
        /** error is null on success. */
        void done(String error);
    }

    private PdfWriter() {}

    public static void write(
        final PrintDocumentAdapter adapter,
        final PrintAttributes attributes,
        final File outFile,
        final Callback callback
    ) {
        adapter.onLayout(
            null,
            attributes,
            new CancellationSignal(),
            new PrintDocumentAdapter.LayoutResultCallback() {
                @Override
                public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                    ParcelFileDescriptor descriptor = null;
                    try {
                        descriptor = ParcelFileDescriptor.open(
                            outFile,
                            ParcelFileDescriptor.MODE_CREATE
                                | ParcelFileDescriptor.MODE_TRUNCATE
                                | ParcelFileDescriptor.MODE_READ_WRITE
                        );
                    } catch (Exception e) {
                        callback.done("Could not open the output file: " + e.getMessage());
                        return;
                    }

                    final ParcelFileDescriptor fd = descriptor;
                    adapter.onWrite(
                        new PageRange[] { PageRange.ALL_PAGES },
                        fd,
                        new CancellationSignal(),
                        new PrintDocumentAdapter.WriteResultCallback() {
                            @Override
                            public void onWriteFinished(PageRange[] pages) {
                                closeQuietly(fd);
                                callback.done(null);
                            }

                            @Override
                            public void onWriteFailed(CharSequence error) {
                                closeQuietly(fd);
                                callback.done(String.valueOf(error));
                            }

                            @Override
                            public void onWriteCancelled() {
                                closeQuietly(fd);
                                callback.done("cancelled");
                            }
                        }
                    );
                }

                @Override
                public void onLayoutFailed(CharSequence error) {
                    callback.done(String.valueOf(error));
                }

                @Override
                public void onLayoutCancelled() {
                    callback.done("cancelled");
                }
            },
            new Bundle()
        );
    }

    private static void closeQuietly(ParcelFileDescriptor fd) {
        try {
            if (fd != null) fd.close();
        } catch (Exception ignored) {
            // The file is already written; a failed close is not worth reporting.
        }
    }
}
