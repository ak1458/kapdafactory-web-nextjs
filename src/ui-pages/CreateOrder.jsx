'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/src/lib/router';
import api from '../lib/api';
import CustomDatePicker from '../components/CustomDatePicker';
import { ChevronLeft, Camera, User, Calendar, Hash, IndianRupee, FileText, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_IMAGES_PER_ORDER = 8;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const COMPRESSION_MIN_SIZE_BYTES = 400 * 1024;
const IMAGE_COMPRESSION_OPTIONS = {
    maxSizeMB: 0.9,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
};

function formatLocalDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CreateOrder() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const todayDate = useMemo(() => formatLocalDate(), []);

    const [formData, setFormData] = useState({
        token: '',
        bill_number: '',
        customer_name: '',
        phone_number: '',
        entry_date: todayDate,  // When the entry is made (defaults to today)
        delivery_date: '',  // When order should be delivered
        remarks: '',
        total_amount: '',
    });
    const [errors, setErrors] = useState({});
    const [images, setImages] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const fileInputRef = useRef(null);
    const latestPreviewUrlsRef = useRef([]);

    const releasePreviewUrls = useCallback((urls) => {
        for (const url of urls) {
            URL.revokeObjectURL(url);
        }
    }, []);

    useEffect(() => {
        latestPreviewUrlsRef.current = previewUrls;
    }, [previewUrls]);

    useEffect(() => {
        return () => {
            releasePreviewUrls(latestPreviewUrlsRef.current);
        };
    }, [releasePreviewUrls]);

    useEffect(() => {
        // Fix: Proactively clear any auto-filled value if it matches the pattern or on mount
        // This addresses the user issue where "BILL-" is auto-generated
        setFormData(prev => {
            if (!prev.token || prev.token.startsWith('BILL-')) {
                return { ...prev, token: '', bill_number: '' };
            }
            return prev;
        });
    }, []);

    const handleImageChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (images.length >= MAX_IMAGES_PER_ORDER) {
            toast.error(`Maximum ${MAX_IMAGES_PER_ORDER} images are allowed per order.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const validFiles = [];
        const validPreviews = [];
        const availableSlots = MAX_IMAGES_PER_ORDER - images.length;
        const filesToProcess = files.slice(0, availableSlots);
        let imageCompression = null;

        try {
            const compressionModule = await import('browser-image-compression');
            imageCompression = compressionModule.default;
        } catch {
            toast.error('Image compression unavailable. Uploading original files.');
        }

        // Process files sequentially to maintain order and prevent browser lag
        for (const file of filesToProcess) {
            // 8MB limit check (pre-compression)
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                toast.error(`File ${file.name} is too large (>8MB). Skipping.`);
                continue;
            }

            if (!file.type.startsWith('image/')) {
                toast.error(`File ${file.name} is not an image. Skipping.`);
                continue;
            }

            try {
                const shouldCompress = Boolean(imageCompression) && file.size >= COMPRESSION_MIN_SIZE_BYTES;
                if (shouldCompress) {
                    const compressedResult = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
                    const compressedFile = compressedResult instanceof File
                        ? compressedResult
                        : new File([compressedResult], file.name || `image-${Date.now()}.jpg`, {
                            type: compressedResult.type || 'image/jpeg',
                        });

                    validFiles.push(compressedFile);
                    validPreviews.push(URL.createObjectURL(compressedFile));
                    continue;
                }

                validFiles.push(file);
                validPreviews.push(URL.createObjectURL(file));

            } catch {
                toast.error(`Failed to compress ${file.name}. Uploading original.`);
                validFiles.push(file);
                validPreviews.push(URL.createObjectURL(file));
            }
        }

        if (validFiles.length === 0) return;

        setImages(prev => [...prev, ...validFiles]);
        setPreviewUrls(prev => [...prev, ...validPreviews]);

        if (files.length > filesToProcess.length) {
            toast.error(`Only ${MAX_IMAGES_PER_ORDER} images can be attached per order.`);
        }

        // Reset input value to allow selecting same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeImage = (index) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...previewUrls];
        const removedPreview = newPreviews[index];
        if (removedPreview) {
            URL.revokeObjectURL(removedPreview);
        }
        newPreviews.splice(index, 1);
        setPreviewUrls(newPreviews);
    };

    const handleSubmit = async () => {
        const newErrors = {};
        const orderNumber = String(formData.token || '').trim();
        const totalAmountValue = Number(formData.total_amount);

        if (!orderNumber) {
            newErrors.token = 'Required';
        }

        if (!Number.isFinite(totalAmountValue) || totalAmountValue <= 0) {
            newErrors.amount = 'Invalid amount';
        }

        if (!formData.delivery_date) {
            newErrors.delivery_date = 'Required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Please correctly fill out all required fields.');
            return;
        }

        setErrors({});
        setLoading(true);

        const data = new FormData();
        data.set('token', orderNumber);
        data.set('bill_number', orderNumber);
        data.set('customer_name', formData.customer_name || '');
        data.set('phone_number', formData.phone_number || '');
        data.set('entry_date', formData.entry_date || '');
        data.set('delivery_date', formData.delivery_date || '');
        data.set('remarks', formData.remarks || '');
        data.set('total_amount', String(totalAmountValue));

        images.forEach((image, index) => {
            if (image instanceof Blob) {
                const name = image instanceof File && image.name ? image.name : `image-${index + 1}.jpg`;
                data.append('images[]', image, name);
            }
        });

        try {
            await api.post('/orders', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Release preview URLs before navigating away
            releasePreviewUrls(previewUrls);
            toast.success('Order created successfully!');
            await new Promise((resolve) => setTimeout(resolve, 500));
            navigate('/dashboard');
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create order.';
            toast.error(`Error: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#ECE5DD] font-sans h-full">
            {/* Header */}
            <header className="flex-none glass-header-green text-white p-4 z-50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold">New Order</h1>
                        <p className="text-xs opacity-80">Create a new order entry</p>
                    </div>
                </div>
            </header>

            {/* Main Content - scrollable */}
            <main className="p-3 overflow-y-auto">

                {/* Form Container - flexible spacing */}
                <div className="flex flex-col gap-2 sm:gap-3 mb-4">
                    {/* Row 1: Token & Amount - responsive height */}
                    <div className="flex gap-2 sm:gap-3 min-h-[60px] sm:min-h-[70px]">
                        <div className={`flex-1 glass-card rounded-xl p-2 sm:p-3 flex flex-col justify-center border transition-colors ${errors.token ? 'border-red-400 bg-red-50/50' : 'border-transparent'}`}>
                            <label className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1 ${errors.token ? 'text-red-500' : 'text-gray-400'}`}>
                                <Hash size={10} className="sm:w-3 sm:h-3" /> Bill / Token *
                            </label>
                            <input
                                type="text"
                                placeholder="A-101"
                                value={formData.token}
                                onChange={(e) => {
                                    setFormData({ ...formData, token: e.target.value });
                                    if (errors.token) setErrors({ ...errors, token: null });
                                }}
                                autoComplete="off"
                                className={`w-full text-base sm:text-lg font-bold placeholder-gray-300 focus:outline-none bg-transparent ${errors.token ? 'text-red-600' : 'text-gray-900'}`}
                            />
                        </div>
                        <div className={`flex-1 glass-card rounded-xl p-2 sm:p-3 flex flex-col justify-center border transition-colors ${errors.amount ? 'border-red-400 bg-red-50/50' : 'border-transparent'}`}>
                            <label className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1 ${errors.amount ? 'text-red-500' : 'text-gray-400'}`}>
                                <IndianRupee size={10} className="sm:w-3 sm:h-3" /> Amount *
                            </label>
                            <div className="flex items-center gap-1">
                                <span className={`font-bold text-base sm:text-lg ${errors.amount ? 'text-red-500' : 'text-gray-400'}`}>?</span>
                                <input
                                    type="number"
                                    value={formData.total_amount || ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, total_amount: e.target.value });
                                        if (errors.amount) setErrors({ ...errors, amount: null });
                                    }}
                                    autoComplete="off"
                                    className={`w-full text-base sm:text-lg font-bold placeholder-gray-300 focus:outline-none bg-transparent ${errors.amount ? 'text-red-600' : 'text-gray-900'}`}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Entry Date & Delivery Date */}
                    <div className="flex gap-2 sm:gap-3 min-h-[60px] sm:min-h-[70px]">
                        <div className="flex-1 bg-white rounded-xl p-2 sm:p-3 shadow-sm border border-gray-100 flex flex-col justify-center">
                            <label className="text-[9px] sm:text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1">
                                <Calendar size={10} className="sm:w-3 sm:h-3" /> Entry Date
                            </label>
                            <CustomDatePicker
                                selected={formData.entry_date}
                                onChange={(date) => setFormData({ ...formData, entry_date: date })}
                                placeholder="Today"
                            />
                        </div>
                        <div className={`flex-1 bg-white rounded-xl p-2 sm:p-3 shadow-sm border flex flex-col justify-center transition-colors ${errors.delivery_date ? 'border-red-400 bg-red-50/30' : 'border-gray-100'}`}>
                            <label className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1 ${errors.delivery_date ? 'text-red-500' : 'text-gray-400'}`}>
                                <Calendar size={10} className="sm:w-3 sm:h-3" /> Delivery *
                            </label>
                            <CustomDatePicker
                                selected={formData.delivery_date}
                                onChange={(date) => {
                                    setFormData({ ...formData, delivery_date: date });
                                    if (errors.delivery_date) setErrors({ ...errors, delivery_date: null });
                                }}
                                minDate={new Date()}
                                placeholder="dd-mm-yyyy"
                            />
                        </div>
                    </div>

                    {/* Row 3: Customer Name & Phone Number */}
                    <div className="flex gap-2 sm:gap-3 min-h-[60px] sm:min-h-[70px]">
                        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl p-2 sm:p-3 shadow-sm border border-white/50 flex flex-col justify-center min-h-[60px] sm:min-h-[70px]">
                            <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1">
                                <User size={10} className="sm:w-3 sm:h-3" /> Customer Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter customer name"
                                value={formData.customer_name}
                                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                className="w-full font-medium text-sm sm:text-base text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
                            />
                        </div>
                        <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl p-2 sm:p-3 shadow-sm border border-white/50 flex flex-col justify-center min-h-[60px] sm:min-h-[70px]">
                            <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 sm:mb-1 flex items-center gap-1">
                                <span className="font-serif">??</span> Phone Number
                            </label>
                            <input
                                type="tel"
                                placeholder="10-digit number"
                                value={formData.phone_number || ''}
                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                className="w-full font-medium text-sm sm:text-base text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
                                maxLength={10}
                            />
                        </div>
                    </div>

                    {/* Row 3: Photos - responsive */}
                    <div className="rounded-xl sm:rounded-2xl p-2 sm:p-3 shadow-lg flex flex-col min-h-[80px] sm:min-h-[100px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.8)' }}>
                        <div className="flex justify-between items-center mb-1 sm:mb-2 flex-none">
                            <h3 className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Camera size={10} className="sm:w-3 sm:h-3" /> Photos
                            </h3>
                            <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">
                                {images.length} added
                            </span>
                        </div>

                        <div className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
                            {/* Add Photo Button - responsive size */}
                            <label
                                className="flex-none flex flex-col items-center justify-center gap-0.5 border-2 border-dashed border-teal-400 rounded-lg sm:rounded-xl cursor-pointer hover:bg-teal-50 transition-all bg-gradient-to-br from-white to-teal-50/50 group shadow-md w-12 h-12 sm:w-16 sm:h-16"
                                onClick={(e) => {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }}
                            >
                                <div className="p-1 sm:p-1.5 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Camera size={14} className="text-teal-600 sm:w-4 sm:h-4" />
                                </div>
                                <span className="text-[7px] sm:text-[8px] font-bold text-teal-600 uppercase">Add</span>
                            </label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageChange}
                                className="hidden"
                            />

                            {/* Previews - responsive size */}
                            {previewUrls.map((url, idx) => (
                                <div key={idx} className="flex-none relative rounded-lg sm:rounded-xl overflow-hidden border-2 border-white shadow-lg group w-12 h-12 sm:w-16 sm:h-16">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            removeImage(idx);
                                        }}
                                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 z-10 hover:bg-red-500 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Row 4: Remarks - responsive */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2 shadow-sm border border-white/50 flex flex-col min-h-[44px] sm:min-h-[56px]">
                        <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1 flex-none">
                            <FileText size={10} className="sm:w-3 sm:h-3" /> Notes
                        </label>
                        <input
                            type="text"
                            placeholder="Add notes (optional)..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            className="w-full flex-1 font-medium text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-4 pb-8">

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed btn-press"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <CheckCircle size={18} className="sm:w-5 sm:h-5" /> Save Record
                            </>
                        )}
                    </button>
                </div>
            </main>

        </div>
    );
}



